// backend/models/UserModel.js
const bcrypt = require('bcryptjs');

function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 72) {
    throw new Error('Password must have at least 12 characters and at most 72 bytes.');
  }
  return bcrypt.hashSync(password, 12);
}

const { db } = require('../config/db');

class UserModel {
  static findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  static findById(id) {
    return db
      .prepare('SELECT id, username, user_type, token_version, created_at FROM users WHERE id = ?')
      .get(id);
  }

  static create(username, password, userType = 1) {
    const stmt = db.prepare('INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)');
    const result = stmt.run(username, hashPassword(password), userType);
    return result.lastInsertRowid;
  }

  static findAll() {
    return db
      .prepare('SELECT id, username, user_type, created_at FROM users ORDER BY created_at DESC')
      .all();
  }

  static updateRole(id, userType) {
    const stmt = db.prepare(
      'UPDATE users SET user_type = ?, token_version = token_version + 1 WHERE id = ?',
    );
    const result = stmt.run(userType, id);
    return result.changes > 0;
  }

  static updatePassword(id, newPassword) {
    return (
      db
        .prepare('UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?')
        .run(hashPassword(newPassword), id).changes > 0
    );
  }

  static updateFull(id, { user_type, password }) {
    const sets = [];
    const params = [];
    if (user_type !== undefined) {
      sets.push('user_type = ?');
      params.push(Number(user_type));
    }
    if (password) {
      sets.push('password = ?');
      params.push(hashPassword(password));
    }
    if (!sets.length) return false;
    sets.push('token_version = token_version + 1');
    params.push(id);
    return (
      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params).changes > 0
    );
  }

  static delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
  }

  static revokeSessions(id) {
    db.prepare('UPDATE users SET token_version = token_version + 1 WHERE id = ?').run(id);
  }

  static countAdmins() {
    return db.prepare('SELECT COUNT(*) AS c FROM users WHERE user_type = 3').get().c;
  }
}

module.exports = UserModel;
