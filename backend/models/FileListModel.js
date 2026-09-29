// backend/models/FileListModel.js
const { db } = require('../config/db');

class FileListModel {
    /**
     * Insert an uploaded file record.
     * @param {string} filename      stored name (timestamp-random-original)
     * @param {string} originalName  user's original filename
     * @param {number} fileSize      bytes
     * @param {number} userId        uploader
     * @param {string} status        'processing' | 'completed' | 'failed'
     * @param {number} kbId          owning knowledge base id
     * @param {string} contentHash   SHA-256 of file content (for dedup)
     */
    static create(filename, originalName, fileSize, userId,
                  status = 'completed', kbId = null, contentHash = null) {
        const stmt = db.prepare(`
            INSERT INTO filelist
              (filename, original_name, file_size, user_id, status, kb_id, content_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            filename, originalName, fileSize, userId, status, kbId, contentHash
        );
        return result.lastInsertRowid;
    }

    /**
     * All files for a user (legacy).
     */
    static findByUserId(userId) {
        return db.prepare(`
            SELECT * FROM filelist
            WHERE user_id = ?
            ORDER BY created_at DESC
        `).all(userId);
    }

    /**
     * All files in a KB. Field names converted to camelCase.
     */
    static findByKbId(kbId) {
        return db.prepare(`
            SELECT
                id,
                filename,
                original_name  AS originalName,
                file_size      AS fileSize,
                user_id        AS userId,
                status,
                kb_id          AS kbId,
                content_hash   AS contentHash,
                created_at     AS createdAt
            FROM filelist
            WHERE kb_id = ?
            ORDER BY created_at DESC
        `).all(kbId);
    }

    /**
     * Lookup by content hash (global dedup).
     */
    static findByHash(hash) {
        if (!hash) return null;
        return db.prepare('SELECT * FROM filelist WHERE content_hash = ?').get(hash);
    }

    /**
     * Lookup by stored filename.
     */
    static findByFilename(filename) {
        return db.prepare('SELECT * FROM filelist WHERE filename = ?').get(filename);
    }

    /**
     * Update processing status.
     */
    static updateStatus(filename, status) {
        return db.prepare('UPDATE filelist SET status = ? WHERE filename = ?')
                 .run(status, filename).changes > 0;
    }

    /**
     * Delete by stored filename.
     * userId optional: pass to restrict to the uploader.
     */
    static deleteByFilename(filename, userId = null) {
        if (userId) {
            return db.prepare('DELETE FROM filelist WHERE filename = ? AND user_id = ?')
                     .run(filename, userId).changes > 0;
        }
        return db.prepare('DELETE FROM filelist WHERE filename = ?')
                 .run(filename).changes > 0;
    }
}

module.exports = FileListModel;