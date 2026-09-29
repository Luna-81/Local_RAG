// backend/models/KnowledgeBaseModel.js
const { db } = require('../config/db');

class KnowledgeBaseModel {
    /**
     * Create a new KB.
     * table_name is "kb_<id>"; we insert a placeholder then backfill.
     */
    static create(name, description = '') {
        const ins = db.prepare(`
            INSERT INTO knowledge_bases (name, description, table_name)
            VALUES (?, ?, ?)
        `).run(name, description, 'pending');

        const id = ins.lastInsertRowid;
        const tableName = `kb_${id}`;

        db.prepare('UPDATE knowledge_bases SET table_name = ? WHERE id = ?')
          .run(tableName, id);

        return this.findById(id);
    }

    /**
     * List all KBs with file counts.
     */
    static findAll() {
        return db.prepare(`
            SELECT
                kb.id,
                kb.name,
                kb.description,
                kb.table_name AS tableName,
                kb.created_at AS createdAt,
                (SELECT COUNT(*) FROM filelist WHERE kb_id = kb.id) AS fileCount
            FROM knowledge_bases kb
            ORDER BY kb.id ASC
        `).all();
    }

    /**
     * Find one by id.
     */
    static findById(id) {
        return db.prepare(`
            SELECT
                id,
                name,
                description,
                table_name AS tableName,
                created_at AS createdAt
            FROM knowledge_bases
            WHERE id = ?
        `).get(id);
    }

    /**
     * Find one by name (for uniqueness checks).
     */
    static findByName(name) {
        return db.prepare(`
            SELECT
                id,
                name,
                description,
                table_name AS tableName,
                created_at AS createdAt
            FROM knowledge_bases
            WHERE name = ?
        `).get(name);
    }

    /**
     * Update name / description. table_name is immutable.
     */
    static update(id, name, description = '') {
        const result = db.prepare(`
            UPDATE knowledge_bases
            SET name = ?, description = ?
            WHERE id = ?
        `).run(name, description, id);
        return result.changes > 0;
    }

    /**
     * Delete a KB record.
     * Caller is responsible for dropping the LanceDB table first.
     */
    static delete(id) {
        return db.prepare('DELETE FROM knowledge_bases WHERE id = ?').run(id).changes > 0;
    }
}

module.exports = KnowledgeBaseModel;