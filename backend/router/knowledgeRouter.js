// backend/router/knowledgeRouter.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const KnowledgeBaseModel = require('../models/KnowledgeBaseModel');
const FileListModel = require('../models/FileListModel');
const { KNOWLEDGE_MAP_CACHE_DIR, PROJECT_ROOT, PYTHON_EXECUTABLE } = require('../config/runtime');

const router = express.Router();

const PARSER_DIR = path.join(PROJECT_ROOT, 'backend', 'parser');
const SCRIPT = path.join(PARSER_DIR, 'knowledge_map.py');
const CACHE_ROOT = KNOWLEDGE_MAP_CACHE_DIR;

fs.mkdirSync(CACHE_ROOT, { recursive: true });

const allowed = authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]);

/**
 * Resolve KB table name from kbId. Falls back to kb_1 for missing/invalid ids.
 */
function resolveTableName(kbId) {
  if (!kbId) return 'kb_1';
  try {
    const kb = KnowledgeBaseModel.findById(Number(kbId));
    return kb ? kb.tableName : 'kb_1';
  } catch (_) {
    return 'kb_1';
  }
}

/**
 * Per-KB cache file path.
 */
const cacheFile = (doc, tableName) =>
  path.join(CACHE_ROOT, tableName, doc.replace(/[^\w.\-]/g, '_') + '.json');

/**
 * Run knowledge_map.py with KB_TABLE env var set.
 */
function runPython(args, tableName, maxBuffer, cb) {
  execFile(
    PYTHON_EXECUTABLE,
    [SCRIPT, ...args],
    {
      cwd: PARSER_DIR,
      maxBuffer: maxBuffer || 10 * 1024 * 1024,
      env: { ...process.env, KB_TABLE: tableName },
    },
    cb,
  );
}

// ---------------------------------------------------------------------------
// ① List all documents in the current KB
// ---------------------------------------------------------------------------
router.get('/documents', authenticate, allowed, (req, res) => {
  const tableName = resolveTableName(req.query.kbId);
  const kbId = Number(req.query.kbId);

  runPython(['--list'], tableName, undefined, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, message: stderr || error.message });
    }
    try {
      const out = JSON.parse(stdout);
      const files = Number.isInteger(kbId) && kbId > 0 ? FileListModel.findByKbId(kbId) : [];
      const originalNames = new Map(files.map((file) => [file.filename, file.originalName]));
      res.json({
        success: true,
        data: (out.documents || []).map((doc) => ({
          ...doc,
          display_name: originalNames.get(doc.document_name) || doc.document_name,
        })),
        tableName,
      });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Failed to parse output.' });
    }
  });
});

// ---------------------------------------------------------------------------
// ② Read cached map for a document (fast; no LLM)
// ---------------------------------------------------------------------------
router.get('/map/:docName', authenticate, allowed, (req, res) => {
  const doc = req.params.docName;
  const tableName = resolveTableName(req.query.kbId);
  const f = cacheFile(doc, tableName);

  if (!fs.existsSync(f)) {
    return res.json({
      success: true,
      cached: false,
      doc_name: doc,
      tableName,
      points: [],
      clusters: [],
    });
  }

  try {
    const body = JSON.parse(fs.readFileSync(f, 'utf-8'));
    res.json({ success: true, cached: true, tableName, ...body });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to read cached map.' });
  }
});

// ---------------------------------------------------------------------------
// ③ Build map for a document (slow; runs LLM)
// ---------------------------------------------------------------------------
router.post('/map/:docName', authenticate, allowed, (req, res) => {
  const doc = req.params.docName;
  const kbId = req.query.kbId || req.body?.kbId;
  const tableName = resolveTableName(kbId);

  runPython(['--doc', doc], tableName, 20 * 1024 * 1024, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, message: stderr || error.message });
    }
    const f = cacheFile(doc, tableName);
    try {
      const body = JSON.parse(fs.readFileSync(f, 'utf-8'));
      res.json({ success: true, cached: true, tableName, ...body });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Failed to read generated map.' });
    }
  });
});

module.exports = router;
