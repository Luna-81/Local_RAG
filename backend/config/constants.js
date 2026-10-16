// backend/config/constants.js

const USER_TYPES = {
    STANDARD: 1,
    AI_OPERATOR: 2,
    SYS_ADMIN: 3,
};

/**
 * Role-to-permission map (RBAC core).
 * - STANDARD (1):    view:user_hub, view:chat
 * - AI_OPERATOR (2): adds manage:documents, manage:lancedb, view:dashboard
 * - SYS_ADMIN (3):   full permissions, including manage:system
 */
const ROLE_PERMISSIONS = {
    [USER_TYPES.STANDARD]: [
        'view:user_hub',
        'view:chat',
    ],
    [USER_TYPES.AI_OPERATOR]: [
        'view:user_hub',
        'view:chat',
        'manage:documents',
        'manage:lancedb',
        'view:dashboard',
    ],
    [USER_TYPES.SYS_ADMIN]: [
        'view:user_hub',
        'view:chat',
        'manage:documents',
        'manage:lancedb',
        'view:dashboard',
        'manage:system',
    ],
};

const TYPE_REDIRECT_MAP = {
    [USER_TYPES.STANDARD]: '/user',
    [USER_TYPES.AI_OPERATOR]: '/lancedb-manager',
    [USER_TYPES.SYS_ADMIN]: '/admin-panel',
};

module.exports = {
    USER_TYPES,
    ROLE_PERMISSIONS,
    TYPE_REDIRECT_MAP,
};
