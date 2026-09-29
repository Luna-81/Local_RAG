// backend/router/kbRouter.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const KnowledgeBaseModel = require('../models/KnowledgeBaseModel');
const FileListModel = require('../models/FileListModel');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');

// Python interpreter / script paths
const parserDir = path.join(__dirname, '../parser');
const venvPython = path.resolve(__dirname, '../../venv/bin/python3');
const pythonExecutable = fs.existsSync(venvPython) ? venvPython : 'python3';
const LANCEDB_ADMIN = path.join(parserDir, 'lancedb_admin.py');

/**
 * Drop a LanceDB table via lancedb_admin.py.
 * Idempotent: "table does not exist" is treated as success.
 */
function dropLanceTable(tableName) {
    return new Promise((resolve, reject) => {
        execFile(
            pythonExecutable,
            [LANCEDB_ADMIN, 'clear', tableName],
            { cwd: parserDir },
            (err, stdout, stderr) => {
                if (err) {
                    return reject(new Error(stderr || err.message));
                }
                try {
                    const data = JSON.parse(stdout.trim());
                    if (data.success) return resolve({ dropped: true });
                    if (/does not exist/i.test(data.message || '')) {
                        return resolve({ dropped: false, reason: 'not_found' });
                    }
                    return reject(new Error(data.message || 'Unknown error'));
                } catch (e) {
                    return reject(new Error(`Bad JSON from lancedb_admin: ${stdout}`));
                }
            }
        );
    });
}

// ============================================================
// GET /api/kb  - list all knowledge bases
// ============================================================
router.get('/', authenticate, (req, res) => {
    try {
        const knowledgeBases = KnowledgeBaseModel.findAll();
        res.json({ success: true, knowledgeBases });
    } catch (err) {
        console.error('[KB] list error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================
// POST /api/kb  - create a knowledge base
// body: { name: string, description?: string }
// ============================================================
router.post(
    '/',
    authenticate,
    authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
    (req, res) => {
        const name = (req.body.name || '').trim();
        const description = (req.body.description || '').trim();

        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (name.length > 50) {
            return res.status(400).json({ success: false, message: 'Name must be 50 characters or fewer' });
        }
        if (KnowledgeBaseModel.findByName(name)) {
            return res.status(409).json({ success: false, message: 'Name already exists' });
        }

        try {
            const kb = KnowledgeBaseModel.create(name, description);
            console.log(`[KB] created: id=${kb.id} name="${kb.name}" table=${kb.tableName}`);
            res.json({ success: true, knowledgeBase: kb });
        } catch (err) {
            console.error('[KB] create error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// ============================================================
// PATCH /api/kb/:id  - rename / update description
// body: { name?: string, description?: string }
// ============================================================
router.patch(
    '/:id',
    authenticate,
    authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
    (req, res) => {
        const id = Number(req.params.id);
        const kb = KnowledgeBaseModel.findById(id);
        if (!kb) {
            return res.status(404).json({ success: false, message: 'Knowledge base not found' });
        }

        const newName = req.body.name !== undefined
            ? String(req.body.name).trim()
            : kb.name;
        const newDesc = req.body.description !== undefined
            ? String(req.body.description).trim()
            : kb.description;

        if (!newName) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (newName.length > 50) {
            return res.status(400).json({ success: false, message: 'Name must be 50 characters or fewer' });
        }

        if (newName !== kb.name) {
            const dup = KnowledgeBaseModel.findByName(newName);
            if (dup && dup.id !== id) {
                return res.status(409).json({ success: false, message: 'Name already exists' });
            }
        }

        try {
            KnowledgeBaseModel.update(id, newName, newDesc);
            res.json({ success: true, knowledgeBase: KnowledgeBaseModel.findById(id) });
        } catch (err) {
            console.error('[KB] update error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// ============================================================
// DELETE /api/kb/:id  - delete a knowledge base
// Constraints: refuse if the KB still contains files.
// Order: drop LanceDB table first, then delete the SQLite record.
// ============================================================
router.delete(
    '/:id',
    authenticate,
    authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
    async (req, res) => {
        const id = Number(req.params.id);
        const kb = KnowledgeBaseModel.findById(id);
        if (!kb) {
            return res.status(404).json({ success: false, message: 'Knowledge base not found' });
        }

        // 1. Refuse if KB still has files
        const files = FileListModel.findByKbId(id);
        if (files.length > 0) {
            return res.status(409).json({
                success: false,
                message: `This knowledge base still contains ${files.length} file(s). Delete them first.`,
                fileCount: files.length,
            });
        }

        // 2. Drop LanceDB table (idempotent)
        try {
            const r = await dropLanceTable(kb.tableName);
            console.log(
                `[KB] lancedb drop ${kb.tableName}: ${r.dropped ? 'dropped' : 'not_found'}`
            );
        } catch (err) {
            console.error(`[KB] lancedb drop failed for ${kb.tableName}:`, err.message);
            return res.status(500).json({
                success: false,
                message: `Failed to drop vector table: ${err.message}`,
            });
        }

        // 3. Delete SQLite record
        try {
            KnowledgeBaseModel.delete(id);
            console.log(`[KB] deleted: id=${id} name="${kb.name}" table=${kb.tableName}`);
            res.json({ success: true });
        } catch (err) {
            console.error('[KB] delete record error:', err);
            res.status(500).json({
                success: false,
                message: `Vector table dropped but failed to delete DB record: ${err.message}`,
            });
        }
    }
);

module.exports = router;