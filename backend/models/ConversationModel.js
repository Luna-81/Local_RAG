// backend/models/ConversationModel.js
const { db } = require('../config/db');

class ConversationModel {
    /**
     * Create or update a conversation.
     * kb_id is set only on first insert (ON CONFLICT does not touch it).
     */
    static save(id, userId, title, messages, kbId = null) {
        const messagesJson = typeof messages === 'string' ? messages : JSON.stringify(messages);
        const stmt = db.prepare(`
            INSERT INTO conversations (id, user_id, title, messages, kb_id, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                messages = excluded.messages,
                updated_at = CURRENT_TIMESTAMP
        `);
        return stmt.run(id, userId, title, messagesJson, kbId);
    }

    /**
     * List conversations for a user, optionally filtered by KB.
     * Pinned first, then most recently updated.
     */
    static findByUserId(userId, kbId = null) {
        if (kbId) {
            return db.prepare(`
                SELECT
                    id,
                    title,
                    title AS name,
                    messages,
                    is_pinned AS isPinned,
                    kb_id     AS kbId,
                    updated_at AS updatedAt
                FROM conversations
                WHERE user_id = ? AND kb_id = ?
                ORDER BY is_pinned DESC, updated_at DESC
            `).all(userId, kbId);
        }
        return db.prepare(`
            SELECT
                id,
                title,
                title AS name,
                messages,
                is_pinned AS isPinned,
                kb_id     AS kbId,
                updated_at AS updatedAt
            FROM conversations
            WHERE user_id = ?
            ORDER BY is_pinned DESC, updated_at DESC
        `).all(userId);
    }

    static findById(id) {
        const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
        if (row && row.messages) {
            try {
                row.messages = JSON.parse(row.messages);
            } catch (e) {
                row.messages = [];
            }
        }
        return row;
    }

    static updateTitle(id, userId, newTitle) {
        const stmt = db.prepare(`
            UPDATE conversations
            SET title = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
        `);
        return stmt.run(newTitle, id, userId).changes > 0;
    }

    static togglePin(id, userId, isPinned) {
        const stmt = db.prepare(`
            UPDATE conversations
            SET is_pinned = ?
            WHERE id = ? AND user_id = ?
        `);
        return stmt.run(isPinned ? 1 : 0, id, userId).changes > 0;
    }

    static delete(id, userId) {
        const stmt = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?');
        return stmt.run(id, userId).changes > 0;
    }
}

module.exports = ConversationModel;