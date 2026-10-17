// backend/router/documentRouter.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { execParser } = require('../services/pythonProcess');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const FileListModel = require('../models/FileListModel');
const KnowledgeBaseModel = require('../models/KnowledgeBaseModel');
const { getUserId } = require('../utils/reqUser');
const { UPLOAD_DIR, VECTORIZE_TIMEOUT_MS } = require('../config/runtime');

// Upload directory
const uploadDir = UPLOAD_DIR;
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    file.mimetype === 'application/pdf'
      ? cb(null, true)
      : cb(new Error('Only PDF files are allowed.'));
  },
});

function removeTemporaryUpload(filePath) {
  if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function rejectUpload(res, filePath, status, message) {
  removeTemporaryUpload(filePath);
  return res.status(status).json({ success: false, message });
}

function resolveUploadKnowledgeBase(kbId) {
  if (!kbId) return { error: { status: 400, message: 'Knowledge base is required' } };

  const kb = KnowledgeBaseModel.findById(kbId);
  if (!kb) return { error: { status: 400, message: 'Knowledge base not found' } };
  return { kb, kbId };
}

function calculateContentHash(filePath) {
  const contents = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

function findDuplicateUpload(hash) {
  const duplicate = FileListModel.findByHash(hash);
  if (!duplicate) return null;

  const knowledgeBase = KnowledgeBaseModel.findById(duplicate.kb_id);
  return {
    success: false,
    message: `This file already exists in knowledge base "${knowledgeBase ? knowledgeBase.name : 'unknown'}"`,
    existing: {
      kbId: duplicate.kb_id,
      kbName: knowledgeBase ? knowledgeBase.name : null,
      originalName: duplicate.original_name,
    },
  };
}

function createUploadRecord(req, file, kbId, hash) {
  const filename = file.filename;
  try {
    FileListModel.create(
      filename,
      file.originalname,
      file.size,
      getUserId(req),
      'processing',
      kbId,
      hash,
    );
    return { filename };
  } catch (error) {
    removeTemporaryUpload(file.path);
    if (String(error.message).includes('UNIQUE')) {
      return {
        error: { status: 409, message: 'This file already exists in a knowledge base' },
      };
    } else {
      console.error('[Upload] DB insert error:', error);
      return { error: { status: 500, message: error.message } };
    }
  }
}

function buildUploadResponse(file, kbId) {
  return {
    id: file.filename,
    originalName: file.originalname,
    size: file.size,
    sizeMB: (file.size / (1024 * 1024)).toFixed(2),
    uploadedAtStr: new Date().toLocaleString(),
    status: 'processing',
    progress: 50,
    kbId,
  };
}

// In-memory processing status
// Map<filename, { status: 'processing' | 'completed' | 'failed', progress: number }>
let processingStatusMap = new Map();

function startVectorization({ filename, originalName, kb, chunkSize = 300, overlap = 30 }) {
  const absoluteFilePath = path.join(uploadDir, filename);
  const args = [
    absoluteFilePath,
    '--chunk_size',
    String(chunkSize),
    '--overlap',
    String(overlap),
    '--original_name',
    originalName,
    '--kb_table',
    kb.tableName,
  ];
  const childEnv = { ...process.env, KB_TABLE: kb.tableName };
  console.log(`[Vectorization Started] ${originalName} -> table=${kb.tableName}`);

  execParser(
    'run.py',
    args,
    {
      env: childEnv,
      maxBuffer: 10 * 1024 * 1024,
      timeout: VECTORIZE_TIMEOUT_MS,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error(`[Vectorization Failed] ${originalName}:`, stderr || error.message);
        processingStatusMap.set(filename, { status: 'failed', progress: 0 });
        try {
          FileListModel.updateStatus(filename, 'failed');
        } catch (dbError) {
          console.error('[Vectorization] Failed to persist failure:', dbError);
        }
      } else {
        console.log(`[Vectorization Completed] ${originalName}`);
        if (stdout) console.log(stdout);
        processingStatusMap.set(filename, { status: 'completed', progress: 100 });
        try {
          FileListModel.updateStatus(filename, 'completed');
        } catch (dbError) {
          console.error('[Vectorization] Failed to persist completion:', dbError);
        }
      }
    },
  );
}

// ============================================================
// GET /api/documents?kbId=1  - list files in a KB
// ============================================================
router.get('/', authenticate, (req, res) => {
  const kbId = req.query.kbId ? Number(req.query.kbId) : null;

  if (!kbId) {
    return res.json({ success: true, documents: [] });
  }

  try {
    const rows = FileListModel.findByKbId(kbId);
    const documents = rows.map((r) => {
      const filePath = path.join(uploadDir, r.filename);
      const exists = fs.existsSync(filePath);
      const size = exists ? fs.statSync(filePath).size : r.fileSize;

      const st = processingStatusMap.get(r.filename) || {
        status: r.status || 'completed',
        progress: 100,
      };

      return {
        id: r.filename,
        originalName: r.originalName,
        size,
        sizeMB: (size / (1024 * 1024)).toFixed(2),
        uploadedAtStr: r.createdAt,
        status: st.status,
        progress: st.progress,
        kbId: r.kbId,
      };
    });

    res.json({ success: true, documents });
  } catch (err) {
    console.error('[Documents] list error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// POST /api/documents/upload
// form-data: file, kbId, chunk_size?, overlap?
// ============================================================
router.post(
  '/upload',
  authenticate,
  authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
  upload.single('file'),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const knowledgeBase = resolveUploadKnowledgeBase(Number(req.body.kbId));
    if (knowledgeBase.error) {
      removeTemporaryUpload(req.file.path);
      return res
        .status(knowledgeBase.error.status)
        .json({ success: false, message: knowledgeBase.error.message });
    }

    let contentHash;
    try {
      contentHash = calculateContentHash(req.file.path);
    } catch (error) {
      console.error('[Upload] File read error:', error);
      return rejectUpload(res, req.file.path, 500, 'Failed to read file');
    }

    const duplicate = findDuplicateUpload(contentHash);
    if (duplicate) {
      removeTemporaryUpload(req.file.path);
      return res.status(409).json(duplicate);
    }

    const uploadRecord = createUploadRecord(req, req.file, knowledgeBase.kbId, contentHash);
    if (uploadRecord.error) {
      return res
        .status(uploadRecord.error.status)
        .json({ success: false, message: uploadRecord.error.message });
    }
    const { filename } = uploadRecord;

    processingStatusMap.set(filename, { status: 'processing', progress: 50 });
    res.json({ success: true, file: buildUploadResponse(req.file, knowledgeBase.kbId) });

    startVectorization({
      filename,
      originalName: req.file.originalname,
      kb: knowledgeBase.kb,
      chunkSize: req.body.chunk_size || 300,
      overlap: req.body.overlap || 30,
    });
  },
);

// ============================================================
// POST /api/documents/:id/retry - retry an interrupted or failed upload
// ============================================================
router.post(
  '/:id/retry',
  authenticate,
  authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
  (req, res) => {
    const filename = path.basename(req.params.id);
    const record = FileListModel.findByFilename(filename);
    if (!record) return res.status(404).json({ success: false, message: 'Document not found.' });
    if (record.status !== 'failed') {
      return res
        .status(409)
        .json({ success: false, message: 'Only failed documents can be retried.' });
    }
    if (!fs.existsSync(path.join(uploadDir, filename))) {
      return res.status(404).json({ success: false, message: 'Uploaded PDF is missing.' });
    }
    const kb = KnowledgeBaseModel.findById(record.kb_id);
    if (!kb) return res.status(409).json({ success: false, message: 'Knowledge base not found.' });
    if (
      FileListModel.findByKbId(record.kb_id).some(
        (file) => file.filename !== filename && file.originalName === record.original_name,
      )
    ) {
      return res.status(409).json({
        success: false,
        message: 'Another document in this knowledge base has the same name.',
      });
    }

    // A failed worker may have written some vectors before exiting.
    execParser(
      'lancedb_admin.py',
      ['delete-document', kb.tableName, filename, record.original_name],
      {},
      (error, stdout, stderr) => {
        if (error) {
          return res.status(500).json({ success: false, message: stderr || error.message });
        }
        if (!FileListModel.retryFailed(filename)) {
          return res
            .status(409)
            .json({ success: false, message: 'Document status changed. Refresh and try again.' });
        }
        processingStatusMap.set(filename, { status: 'processing', progress: 50 });
        res.json({ success: true, message: 'Vectorization restarted.' });
        startVectorization({ filename, originalName: record.original_name, kb });
      },
    );
  },
);

function resolveDocumentDeletion(filename) {
  const record = FileListModel.findByFilename(filename);
  if (!record) return { status: 404, message: 'Document not found.' };
  if (processingStatusMap.get(filename)?.status === 'processing') {
    return { status: 409, message: 'Wait for document processing to finish before deleting.' };
  }

  const kb = KnowledgeBaseModel.findById(record.kb_id);
  if (!kb) return { status: 409, message: 'Document knowledge base not found.' };

  const hasSameNameDocument = FileListModel.findByKbId(record.kb_id).some(
    (file) => file.filename !== filename && file.originalName === record.original_name,
  );
  if (hasSameNameDocument) {
    return {
      status: 409,
      message:
        'Another document in this knowledge base has the same original name. Rename or remove the duplicate before deleting.',
    };
  }
  return { record, kb };
}

function deleteDocumentVectors(tableName, filename, originalName) {
  return new Promise((resolve, reject) => {
    execParser(
      'lancedb_admin.py',
      ['delete-document', tableName, filename, originalName],
      {},
      (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve(stdout);
      },
    );
  });
}

function deleteDocumentFile(filename, filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log('File deleted:', filename);
  } else {
    console.warn('File not found on server:', filePath);
  }
}

// ============================================================
// DELETE /api/documents/:id  - remove physical file + DB record
// ============================================================
router.delete(
  '/:id',
  authenticate,
  authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
  async (req, res) => {
    try {
      const filename = path.basename(decodeURIComponent(req.params.id));
      const filePath = path.join(uploadDir, filename);
      const document = resolveDocumentDeletion(filename);
      if (document.status) {
        return res.status(document.status).json({ success: false, message: document.message });
      }

      // Remove vectors first. If this fails, keep the PDF and metadata so deletion can be retried.
      await deleteDocumentVectors(document.kb.tableName, filename, document.record.original_name);
      deleteDocumentFile(filename, filePath);
      processingStatusMap.delete(filename);
      FileListModel.deleteByFilename(filename);

      return res.json({
        success: true,
        message: 'Document deleted successfully',
        id: filename,
      });
    } catch (err) {
      console.error('Delete document error:', err);
      return res.status(500).json({
        success: false,
        message: err.message || 'Failed to delete file',
      });
    }
  },
);

module.exports = router;
