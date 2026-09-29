// backend/config/constants.js

const USER_TYPES = {
    STANDARD: 1,     // 普通用户
    AI_OPERATOR: 2,  // AI 管理员
    SYS_ADMIN: 3     // 系统管理员 / 老板
};

/**
 * 角色权限集映射 (RBAC 核心)
 * - 普通用户 (1): 仅 view:user_hub 和 view:chat，绝无 manage:documents
 * - AI管理员 (2): 增加 manage:documents, manage:lancedb, view:dashboard
 * - 系统管理员 (3): 包含全量权限 (含 manage:system)
 */
const ROLE_PERMISSIONS = {
    [USER_TYPES.STANDARD]: [
        'view:user_hub',
        'view:chat'
    ],
    [USER_TYPES.AI_OPERATOR]: [
        'view:user_hub',
        'view:chat',
        'manage:documents',
        'manage:lancedb',
        'view:dashboard'
    ],
    [USER_TYPES.SYS_ADMIN]: [
        'view:user_hub',
        'view:chat',
        'manage:documents',
        'manage:lancedb',
        'view:dashboard',
        'manage:system'
    ]
};

const TYPE_REDIRECT_MAP = {
    [USER_TYPES.STANDARD]: '/user',
    [USER_TYPES.AI_OPERATOR]: '/lancedb-manager',
    [USER_TYPES.SYS_ADMIN]: '/admin-panel'
};

module.exports = {
    USER_TYPES,
    ROLE_PERMISSIONS,
    TYPE_REDIRECT_MAP
};