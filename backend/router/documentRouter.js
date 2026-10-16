// backend/router/documentRouter.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { execFile } = require('child_process');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const FileListModel = require('../models/FileListModel');
const KnowledgeBaseModel = require('../models/KnowledgeBaseModel');
const { getUserId } = require('../utils/reqUser');

// Upload / parser directories
const uploadDir = path.join(__dirname, '../../data/raw_pdfs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const parserDir = path.join(__dirname, '../parser');
const RUN_SCRIPT = path.join(parserDir, 'run.py');
const LANCEDB_ADMIN_SCRIPT = path.join(parserDir, 'lancedb_admin.py');

// Prefer the project virtualenv, fall back to the system python3.
function resolvePython() {
    const venvPython = path.resolve(__dirname, '../../venv/bin/python3');
    return fs.existsSync(venvPython) ? venvPython : 'python3';
}

// Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, unique + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        file.mimetype === 'application/pdf'
            ? cb(null, true)
            : cb(new Error('Only PDF files are allowed.'));
    }
});

// In-memory processing status
// Map<filename, { status: 'processing' | 'completed' | 'failed', progress: number }>
let processingStatusMap = new Map();

function startVectorization({ filename, originalName, kb, chunkSize = 300, overlap = 30 }) {
    const absoluteFilePath = path.join(uploadDir, filename);
    const pythonExecutable = resolvePython();
    const args = [
        RUN_SCRIPT, absoluteFilePath,
        '--chunk_size', String(chunkSize),
        '--overlap', String(overlap),
        '--original_name', originalName,
        '--kb_table', kb.tableName
    ];
    const childEnv = { ...process.env, KB_TABLE: kb.tableName };
    console.log(`[Vectorization Started] ${originalName} -> table=${kb.tableName}`);

    execFile(pythonExecutable, args, {
        cwd: parserDir,
        env: childEnv,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 15 * 60 * 1000,
    }, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Vectorization Failed] ${originalName}:`, stderr || error.message);
            processingStatusMap.set(filename, { status: 'failed', progress: 0 });
            try { FileListModel.updateStatus(filename, 'failed'); } catch (dbError) {
                console.error('[Vectorization] Failed to persist failure:', dbError);
            }
        } else {
            console.log(`[Vectorization Completed] ${originalName}`);
            if (stdout) console.log(stdout);
            processingStatusMap.set(filename, { status: 'completed', progress: 100 });
            try { FileListModel.updateStatus(filename, 'completed'); } catch (dbError) {
                console.error('[Vectorization] Failed to persist completion:', dbError);
            }
        }
    });
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
                progress: 100
            };

            return {
                id: r.filename,
                originalName: r.originalName,
                size,
                sizeMB: (size / (1024 * 1024)).toFixed(2),
                uploadedAtStr: r.createdAt,
                status: st.status,
                progress: st.progress,
                kbId: r.kbId
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

        // 1. Validate KB
        const kbId = Number(req.body.kbId);
        if (!kbId) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Knowledge base is required' });
        }
        const kb = KnowledgeBaseModel.findById(kbId);
        if (!kb) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ success: false, message: 'Knowledge base not found' });
        }

        // 2. Content hash for global dedup
        let hash;
        try {
            const buf = fs.readFileSync(req.file.path);
            hash = crypto.createHash('sha256').update(buf).digest('hex');
        } catch (err) {
            fs.unlinkSync(req.file.path);
            return res.status(500).json({ success: false, message: 'Failed to read file' });
        }

        const dup = FileListModel.findByHash(hash);
        if (dup) {
            fs.unlinkSync(req.file.path);
            const dupKb = KnowledgeBaseModel.findById(dup.kb_id);
            return res.status(409).json({
                success: false,
                message: `This file already exists in knowledge base "${dupKb ? dupKb.name : 'unknown'}"`,
                existing: {
                    kbId: dup.kb_id,
                    kbName: dupKb ? dupKb.name : null,
                    originalName: dup.original_name
                }
            });
        }

        // 3. Insert DB record
        const filename = req.file.filename;
        const userId = getUserId(req);
        try {
            FileListModel.create(
                filename,
                req.file.originalname,
                req.file.size,
                userId,
                'processing',
                kbId,
                hash
            );
        } catch (err) {
            fs.unlinkSync(req.file.path);
            if (String(err.message).includes('UNIQUE')) {
                return res.status(409).json({
                    success: false,
                    message: 'This file already exists in a knowledge base'
                });
            }
            console.error('[Upload] DB insert error:', err);
            return res.status(500).json({ success: false, message: err.message });
        }

        // 4. Respond immediately
        processingStatusMap.set(filename, { status: 'processing', progress: 50 });

        const docInfo = {
            id: filename,
            originalName: req.file.originalname,
            size: req.file.size,
            sizeMB: (req.file.size / (1024 * 1024)).toFixed(2),
            uploadedAtStr: new Date().toLocaleString(),
            status: 'processing',
            progress: 50,
            kbId
        };
        res.json({ success: true, file: docInfo });

        startVectorization({
            filename,
            originalName: req.file.originalname,
            kb,
            chunkSize: req.body.chunk_size || 300,
            overlap: req.body.overlap || 30,
        });
    }
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
            return res.status(409).json({ success: false, message: 'Only failed documents can be retried.' });
        }
        if (!fs.existsSync(path.join(uploadDir, filename))) {
            return res.status(404).json({ success: false, message: 'Uploaded PDF is missing.' });
        }
        const kb = KnowledgeBaseModel.findById(record.kb_id);
        if (!kb) return res.status(409).json({ success: false, message: 'Knowledge base not found.' });
        if (FileListModel.findByKbId(record.kb_id).some(
            (file) => file.filename !== filename && file.originalName === record.original_name
        )) {
            return res.status(409).json({ success: false, message: 'Another document in this knowledge base has the same name.' });
        }

        // A failed worker may have written some vectors before exiting.
        execFile(resolvePython(),
            [LANCEDB_ADMIN_SCRIPT, 'delete-document', kb.tableName, filename, record.original_name],
            { cwd: parserDir }, (error, stdout, stderr) => {
                if (error) {
                    return res.status(500).json({ success: false, message: stderr || error.message });
                }
                if (!FileListModel.retryFailed(filename)) {
                    return res.status(409).json({ success: false, message: 'Document status changed. Refresh and try again.' });
                }
                processingStatusMap.set(filename, { status: 'processing', progress: 50 });
                res.json({ success: true, message: 'Vectorization restarted.' });
                startVectorization({ filename, originalName: record.original_name, kb });
            });
    }
);

// ============================================================
// DELETE /api/documents/:id  - remove physical file + DB record
// ============================================================
router.delete(
    '/:id',
    authenticate,
    authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
    async (req, res) => {
        try {
            const safeFileName = path.basename(decodeURIComponent(req.params.id));
            const filePath = path.join(uploadDir, safeFileName);

            const record = FileListModel.findByFilename(safeFileName);
            if (!record) {
                return res.status(404).json({ success: false, message: 'Document not found.' });
            }
            if (processingStatusMap.get(safeFileName)?.status === 'processing') {
                return res.status(409).json({ success: false, message: 'Wait for document processing to finish before deleting.' });
            }
            const kb = KnowledgeBaseModel.findById(record.kb_id);
            if (!kb) {
                return res.status(409).json({ success: false, message: 'Document knowledge base not found.' });
            }
            const sameName = FileListModel.findByKbId(record.kb_id).some(
                (file) => file.filename !== safeFileName && file.originalName === record.original_name
            );
            if (sameName) {
                return res.status(409).json({
                    success: false,
                    message: 'Another document in this knowledge base has the same original name. Rename or remove the duplicate before deleting.',
                });
            }

            // Remove vectors first. If this fails, keep the PDF and metadata so deletion can be retried.
            await new Promise((resolve, reject) => {
                execFile(resolvePython(), [LANCEDB_ADMIN_SCRIPT, 'delete-document',
                    kb.tableName, safeFileName, record.original_name],
                { cwd: parserDir }, (error, stdout, stderr) => {
                    if (error) reject(new Error(stderr || error.message));
                    else resolve(stdout);
                });
            });

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('File deleted:', safeFileName);
            } else {
                console.warn('File not found on server:', filePath);
            }

            processingStatusMap.delete(safeFileName);

            FileListModel.deleteByFilename(safeFileName);

            return res.json({
                success: true,
                message: 'Document deleted successfully',
                id: safeFileName
            });
        } catch (err) {
            console.error('Delete document error:', err);
            return res.status(500).json({
                success: false,
                message: err.message || 'Failed to delete file'
            });
        }
    }
);

module.exports = router;