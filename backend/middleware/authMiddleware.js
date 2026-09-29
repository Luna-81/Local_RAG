// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { USER_TYPES } = require('../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'your-internal-system-secret-key-2026';

function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Authentication token missing.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
        }
        req.user = decodedUser; // Payload: { id, username, user_type }
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