// frontend/src/App.js
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/Navbar';
import Login from './pages/Login';
import { ALL_ROUTES } from './config/routes';

const ALL_PERMISSIONS = [
    'view:user_hub',
    'view:chat',
    'manage:documents',
    'manage:lancedb',
    'view:dashboard',
    'manage:system'
];

/**
 * 前端容错降级逻辑：
 * 当 localStorage 留有旧数据或后端没发 permissions 时，按 user_type 自动解析权限
 */
const getPermissionsByUserType = (userType) => {
    const typeNum = Number(userType);
    if (typeNum === 3) {
        return ALL_PERMISSIONS;
    }
    if (typeNum === 2) {
        return ['view:user_hub', 'view:chat', 'manage:documents', 'manage:lancedb', 'view:dashboard'];
    }
    // 普通用户绝对不包含 manage:documents
    return ['view:user_hub', 'view:chat'];
};

function App() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
    });

    const handleLogin = (userData) => {
        setUser(userData);
    };

    const handleLogout = () => {
        setUser(null);
    };

    // 优先读取 user.permissions，无权限时自动触发降级补全
    const userPermissions = (user?.permissions && user.permissions.length > 0)
        ? user.permissions
        : getPermissionsByUserType(user?.user_type);

    // 过滤出有权访问的 Route 列表
    const allowedRoutes = ALL_ROUTES.filter((route) =>
        userPermissions.includes(route.permission)
    );

    const defaultRedirectPath = allowedRoutes[0]?.path || '/user';
    const currentUserWithPerms = user ? { ...user, permissions: userPermissions } : null;

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            {user && <Navbar user={currentUserWithPerms} onLogout={handleLogout} />}

            <main style={{ flex: 1, padding: '1.5rem', background: '#f8fafc' }}>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            user ? <Navigate to={defaultRedirectPath} replace /> : <Login onLogin={handleLogin} />
                        }
                    />

                    {/* 仅注册允许访问的受保护路由 */}
                    {user &&
                        allowedRoutes.map((route) => {
                            const Component = route.component;
                            return (
                                <Route
                                    key={route.path}
                                    path={route.path}
                                    element={<Component />}
                                />
                            );
                        })}

                    {/* 未配置路径或越权访问时直接回退重定向 */}
                    <Route
                        path="*"
                        element={<Navigate to={user ? defaultRedirectPath : '/login'} replace />}
                    />
                </Routes>
            </main>
        </div>
    );
}

export default App;