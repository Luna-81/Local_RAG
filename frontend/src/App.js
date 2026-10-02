// frontend/src/App.js
import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import Navbar from './components/common/Navbar';
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


const getPermissionsByUserType = (userType) => {
    const typeNum = Number(userType);
    if (typeNum === 3) {
        return ALL_PERMISSIONS;
    }
    if (typeNum === 2) {
        return ['view:user_hub', 'view:chat', 'manage:documents', 'manage:lancedb', 'view:dashboard'];
    }
     
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

     
    const userPermissions = (user?.permissions && user.permissions.length > 0)
        ? user.permissions
        : getPermissionsByUserType(user?.user_type);

    
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