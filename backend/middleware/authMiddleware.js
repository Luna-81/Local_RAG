// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { USER_TYPES } = require('../config/constants');

const { JWT_SECRET } = require('../config/auth');
const UserModel = require('../models/UserModel');

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const match = typeof authHeader === 'string' && /^Bearer ([^\s]+)$/i.exec(authHeader);
    const token = match && match[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication token missing.' });
    }

    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'local-rag', audience: 'local-rag-api' }, (err, decodedUser) => {
        if (err) {
            return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
        }
        if (!Number.isInteger(decodedUser.id) || !Number.isInteger(decodedUser.token_version) || !Number.isInteger(decodedUser.exp)) {
            return res.status(401).json({ success: false, message: 'Invalid token identity.' });
        }
        try {
            const user = UserModel.findById(decodedUser.id);
            if (!user || user.token_version !== decodedUser.token_version) {
                return res.status(401).json({ success: false, message: 'Session expired.' });
            }
            req.user = user;
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Authentication unavailable.' });
        }
        next();
    });
}

/**
 * Authorization guard checking for required user_type numbers
 * @param {Array<number>} allowedTypes E.g., [USER_TYPES.SYS_ADMIN] or [USER_TYPES.AI_OPERATOR, USER_TYPES.SYS_ADMIN]
 */
function authorize(allowedTypes = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Unauthenticated user identity.' });
        }

        if (!allowedTypes.includes(req.user.user_type)) {
            return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
        }

        next();
    };
}

module.exports = {
    JWT_SECRET,
    authenticate,
    authorize
};