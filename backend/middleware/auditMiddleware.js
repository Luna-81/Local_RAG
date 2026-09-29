// backend/middleware/auditMiddleware.js
const AuditModel = require('../models/AuditModel');

const SKIP_METHODS = new Set(['OPTIONS']);

function auditLogger(req, res, next) {
    if (SKIP_METHODS.has(req.method)) return next();

    const url = req.originalUrl || req.url;
    if (!url.startsWith('/api')) return next();
    if (url.startsWith('/api/health')) return next();

    const start = Date.now();

    // res 'finish' 触发时，authenticate 已跑完，req.user 可读
    res.on('finish', () => {
        try {
            AuditModel.record({
                user_id:     req.user?.id ?? null,
                username:    req.user?.username ?? (req.body?.username ?? null),
                method:      req.method,
                path:        url.split('?')[0],
                status:      res.statusCode,
                ip:          (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
                             || req.socket?.remoteAddress
                             || null,
                duration_ms: Date.now() - start,
            });
        } catch (e) {
            console.error('[Audit] record failed:', e.message);
        }
    });

    next();
}

module.exports = { auditLogger };