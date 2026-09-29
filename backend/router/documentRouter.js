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

// Upload / parser directories
const uploadDir = path.join(__dirname, '../../data/raw_pdfs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const parserDir = path.join(__dirname, '../parser');
const RUN_SCRIPT = path.join(parserDir, 'run.py');

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

// Extract current user id (compatible with different auth middleware shapes)
const getUserId = (req) =>
    (req.user && (req.user.id || req.user.userId)) || 1;

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

        // 5. Async vectorization
        const chunkSize = String(req.body.chunk_size || 300);
        const overlap = String(req.body.overlap || 30);
        const absoluteFilePath = path.resolve(req.file.path);

        const venvPython = path.resolve(__dirname, '../../venv/bin/python3');
        const pythonExecutable = fs.existsSync(venvPython) ? venvPython : 'python3';

        const args = [
            RUN_SCRIPT, absoluteFilePath,
            '--chunk_size', chunkSize,
            '--overlap', overlap,
            '--original_name', req.file.originalname,   // display name for DB
            '--kb_table', kb.tableName
        ];

        const childEnv = { ...process.env, KB_TABLE: kb.tableName };

        console.log(
            `[Vectorization Started] ${req.file.originalname} -> table=${kb.tableName} (kbId=${kbId})`
        );

        execFile(pythonExecutable, args, { cwd: parserDir, env: childEnv },
            (error, stdout, stderr) => {
                if (error) {
                    console.error(
                        `[Vectorization Failed] ${req.file.originalname}:`,
                        stderr || error.message
                    );
                    processingStatusMap.set(filename, { status: 'failed', progress: 0 });
                    try { FileListModel.updateStatus(filename, 'failed'); } catch (_) {}
                } else {
                    console.log(`[Vectorization Completed] ${req.file.originalname}`);
                    if (stdout) console.log(stdout);
                    processingStatusMap.set(filename, { status: 'completed', progress: 100 });
                    try { FileListModel.updateStatus(filename, 'completed'); } catch (_) {}
                }
            }
        );
    }
);

// ============================================================
// DELETE /api/documents/:id  - remove physical file + DB record
// ============================================================
router.delete(
    '/:id',
    authenticate,
    authorize([USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]),
    (req, res) => {
        try {
            const safeFileName = path.basename(decodeURIComponent(req.params.id));
            const filePath = path.join(uploadDir, safeFileName);

            const record = FileListModel.findByFilename(safeFileName);

            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('File deleted:', safeFileName);
            } else {
                console.warn('File not found on server:', filePath);
            }

            processingStatusMap.delete(safeFileName);

            if (record) {
                FileListModel.deleteByFilename(safeFileName);
            }

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