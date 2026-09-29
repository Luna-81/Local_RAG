// backend/models/UserModel.js
const { db } = require('../config/db');

class UserModel {
    static findByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    }

    static findById(id) {
        return db.prepare('SELECT id, username, user_type, created_at FROM users WHERE id = ?').get(id);
    }

    static create(username, password, userType = 1) {
        const stmt = db.prepare('INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)');
        const result = stmt.run(username, password, userType);
        return result.lastInsertRowid;
    }

    static findAll() {
        return db.prepare('SELECT id, username, user_type, created_at FROM users ORDER BY created_at DESC').all();
    }

    static updateRole(id, userType) {
        const stmt = db.prepare('UPDATE users SET user_type = ? WHERE id = ?');
        const result = stmt.run(userType, id);
        return result.changes > 0;
    }

    static updatePassword(id, newPassword) {
        return db.prepare('UPDATE users SET password = ? WHERE id = ?')
                 .run(newPassword, id).changes > 0;
    }

    static updateFull(id, { user_type, password }) {
        const sets = [];
        const params = [];
        if (user_type !== undefined) { sets.push('user_type = ?'); params.push(Number(user_type)); }
        if (password)                { sets.push('password = ?');  params.push(password); }
        if (!sets.length) return false;
        params.push(id);
        return db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
                 .run(...params).changes > 0;
    }

    static delete(id) {
        return db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0;
    }

    static countAdmins() {
        return db.prepare('SELECT COUNT(*) AS c FROM users WHERE user_type = 3').get().c;
    }

}

module.exports = UserModel;