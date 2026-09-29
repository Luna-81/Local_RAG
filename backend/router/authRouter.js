// backend/router/authRouter.js
const express = require('express');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/UserModel');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const { TYPE_REDIRECT_MAP, ROLE_PERMISSIONS } = require('../config/constants');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
        const user = UserModel.findByUsername(username);

        if (!user || user.password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        // 解析当前用户的权限集合
        const userPermissions = ROLE_PERMISSIONS[user.user_type] || ROLE_PERMISSIONS[1];

        const token = jwt.sign(
            { id: user.id, username: user.username, user_type: user.user_type },
            JWT_SECRET,
            { expiresIn: '24h' }
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