// backend/router/authRouter.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/UserModel');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { TYPE_REDIRECT_MAP, ROLE_PERMISSIONS } = require('../config/constants');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Per-process limit; shared deployments should enforce this at the gateway too.
const loginAttempts = new Map();
const loginWindowMs = 15 * 60 * 1000;
router.post('/login', (req, res, next) => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
        if (entry.resetAt <= now) loginAttempts.delete(ip);
    }
    const key = req.ip;
    const entry = loginAttempts.get(key) || { count: 0, resetAt: now + loginWindowMs };
    if (entry.count >= 20 || (!loginAttempts.has(key) && loginAttempts.size >= 10000)) {
        res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ success: false, message: 'Too many login attempts. Please try later.' });
    }
    entry.count += 1;
    loginAttempts.set(key, entry);
    next();
}, (req, res) => {
    const { username, password } = req.body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || Buffer.byteLength(password) > 72) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
        const user = UserModel.findByUsername(username);

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        // 解析当前用户的权限集合
        const userPermissions = ROLE_PERMISSIONS[user.user_type] || ROLE_PERMISSIONS[1];

        const token = jwt.sign(
            { id: user.id, username: user.username, token_version: user.token_version },
            JWT_SECRET,
            { expiresIn: '1h', algorithm: 'HS256', issuer: 'local-rag', audience: 'local-rag-api' }
        );

        const redirectUrl = TYPE_REDIRECT_MAP[user.user_type] || '/user';

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                user_type: user.user_type,
                permissions: userPermissions // 注入权限列表
            },
            redirectUrl
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/logout', authenticate, (req, res) => {
    UserModel.revokeSessions(req.user.id);
    res.json({ success: true });
});

router.get('/me', authenticate, (req, res) => {
    try {
        const user = UserModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const userPermissions = ROLE_PERMISSIONS[user.user_type] || ROLE_PERMISSIONS[1];
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                user_type: user.user_type,
                permissions: userPermissions,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


module.exports = router;