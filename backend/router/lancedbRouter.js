// backend/router/lancedbRouter.js
const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const KnowledgeBaseModel = require('../models/KnowledgeBaseModel');
const { execParser } = require('../services/pythonProcess');

const router = express.Router();

/**
 * GET /api/lancedb/stats
 * Returns LanceDB table counts, vector counts, and storage location.
 * Each table is enriched with the KB display name (kbName).
 */
router.get(
  '/stats',
  authenticate,
  authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
  (req, res) => {
    execParser('lancedb_admin.py', ['stats'], {}, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ success: false, message: stderr || error.message });
      }
      try {
        const data = JSON.parse(stdout);

        const kbMap = {};
        try {
          for (const kb of KnowledgeBaseModel.findAll()) {
            kbMap[kb.tableName] = kb.name;
          }
        } catch (_) {}

        data.tables = (data.tables || []).map((t) => ({
          ...t,
          kbName: kbMap[t.name] || null,
        }));

        res.json({ success: true, data });
      } catch (parseErr) {
        res.status(500).json({
          success: false,
          message: 'Failed to parse Python script output.',
        });
      }
    });
  },
);

/**
 * POST /api/lancedb/clear-table
 * Maintenance-only endpoint. NOT exposed in the UI.
 * Prefer using DELETE /api/kb/:id for normal KB deletion.
 */
router.post(
  '/clear-table',
  authenticate,
  authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
  (req, res) => {
    const { tableName } = req.body;
    if (!tableName) {
      return res.status(400).json({ success: false, message: 'tableName parameter is required.' });
    }

    execParser('lancedb_admin.py', ['clear', tableName], {}, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ success: false, message: stderr || error.message });
      }
      try {
        const data = JSON.parse(stdout);
        res.json({ success: true, data });
      } catch (parseErr) {
        res.status(500).json({
          success: false,
          message: 'Failed to parse Python script output.',
        });
      }
    });
  },
);

module.exports = router;
