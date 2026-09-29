// backend/models/AuditModel.js
const { db } = require('../config/db');

class AuditModel {
    static record({ user_id, username, method, path, status, ip, duration_ms }) {
        return db.prepare(`
            INSERT INTO audit_log (user_id, username, method, path, status, ip, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user_id, username, method, path, status, ip, duration_ms);
    }

    static query({ username, path, status, from, to, page = 1, limit = 50 }) {
        const conds = [];
        const params = [];
        if (username) { conds.push('username LIKE ?'); params.push(`%${username}%`); }
        if (path)     { conds.push('path LIKE ?');     params.push(`%${path}%`); }
        if (status)   { conds.push('status = ?');      params.push(Number(status)); }
        if (from)     { conds.push('created_at >= ?'); params.push(from); }
        if (to)       { conds.push('created_at <= ?'); params.push(to); }
        const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

        const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${where}`).get(...params).c;
        const offset = (Number(page) - 1) * Number(limit);
        const rows = db.prepare(`
            SELECT * FROM audit_log ${where}
            ORDER BY id DESC
            LIMIT ? OFFSET ?
        `).all(...params, Number(limit), offset);

        return { total, page: Number(page), limit: Number(limit), rows };
    }

    static clearAll() {
        return db.prepare('DELETE FROM audit_log').run().changes;
    }
}

module.exports = AuditModel;