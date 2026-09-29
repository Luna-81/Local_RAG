// backend/router/adminRouter.js
const express = require('express');
const UserModel = require('../models/UserModel');
const QAStatsModel = require('../models/QAStatsModel');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const AuditModel = require('../models/AuditModel');

const router = express.Router();

// Restrict all endpoints in this router strictly to SYS_ADMIN (user_type = 3)
router.use(authenticate, authorize([USER_TYPES.SYS_ADMIN]));

/**
 * GET /api/admin/users
 * Returns list of all system users
 */
router.get('/users', (req, res) => {
    try {
        const users = UserModel.findAll();
        res.json({ success: true, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/admin/users/:id/role
 * Updates user_type (permissions) for a specified user
 */
router.put('/users/:id/role', (req, res) => {
    const { id } = req.params;
    const { user_type } = req.body;

    const validTypes = Object.values(USER_TYPES);
    if (!validTypes.includes(Number(user_type))) {
        return res.status(400).json({ success: false, message: 'Invalid user_type specified.' });
    }

    try {
        const updated = UserModel.updateRole(id, Number(user_type));

        if (!updated) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        res.json({ success: true, message: `User permissions successfully updated to type ${user_type}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/admin/qa-stats
 * Fetches recent QA queries for system dashboard analytics
 */
router.get('/qa-stats', (req, res) => {
    try {
        const stats = QAStatsModel.getRecent(50);
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post('/users', (req, res) => {
    const { username, password, user_type = 1 } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'username and password required.' });
    }
    if (!Object.values(USER_TYPES).includes(Number(user_type))) {
        return res.status(400).json({ success: false, message: 'Invalid user_type.' });
    }
    try {
        const id = UserModel.create(username, password, Number(user_type));
        res.json({ success: true, id, message: `User '${username}' created.` });
    } catch (err) {
        if (String(err.message).includes('UNIQUE')) {
            return res.status(409).json({ success: false, message: 'Username already exists.' });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/admin/users/:id
 * Full update: optional password + user_type
 */
router.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { password, user_type } = req.body;
    if (user_type !== undefined && !Object.values(USER_TYPES).includes(Number(user_type))) {
        return res.status(400).json({ success: false, message: 'Invalid user_type.' });
    }
    try {
        const ok = UserModel.updateFull(id, { user_type, password });
        if (!ok) return res.status(404).json({ success: false, message: 'User not found or nothing to update.' });
        res.json({ success: true, message: 'User updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/admin/users/:id
 * Guards: can't delete yourself, can't delete the last admin
 */
router.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    if (Number(id) === req.user.id) {
        return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }
    try {
        const target = UserModel.findById(id);
        if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
        if (target.user_type === USER_TYPES.SYS_ADMIN && UserModel.countAdmins() <= 1) {
            return res.status(400).json({ success: false, message: 'Cannot delete the last SYS_ADMIN.' });
        }
        UserModel.delete(id);
        res.json({ success: true, message: `User '${target.username}' deleted.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/admin/logs
 * Query audit log with filters + pagination
 */
router.get('/logs', (req, res) => {
    try {
        const result = AuditModel.query({
            username: req.query.username,
            path:     req.query.path,
            status:   req.query.status,
            from:     req.query.from,
            to:       req.query.to,
            page:     req.query.page || 1,
            limit:    Math.min(Number(req.query.limit) || 50, 200),
        });
        res.json({ success: true, ...result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/admin/logs
 * Clear all audit records
 */
router.delete('/logs', (req, res) => {
    try {
        const removed = AuditModel.clearAll();
        res.json({ success: true, removed });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;