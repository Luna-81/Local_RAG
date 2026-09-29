// backend/models/QAStatsModel.js
const { db } = require('../config/db');

class QAStatsModel {
    /**
     * Record a new QA query
     */
    static record(userId, question) {
        const stmt = db.prepare('INSERT INTO qa_stats (user_id, question) VALUES (?, ?)');
        return stmt.run(userId, question).lastInsertRowid;
    }

    /**
     * Fetch recent QA stats with usernames for Admin analytics
     */
    static getRecent(limit = 50) {
        return db.prepare(`
            SELECT qa_stats.id, qa_stats.question, qa_stats.created_at, users.username 
            FROM qa_stats 
            JOIN users ON qa_stats.user_id = users.id 
            ORDER BY qa_stats.created_at DESC 
            LIMIT ?
        `).all(limit);
    }
}

module.exports = QAStatsModel;