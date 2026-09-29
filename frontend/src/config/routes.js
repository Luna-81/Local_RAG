// frontend/src/config/routes.js
import UserHub from '../pages/UserHub';
import Chat from '../pages/Chat';
import Documents from '../pages/Documents';
import LanceDBManager from '../pages/LanceDBManager';
import Dashboard from '../pages/Dashboard';
import AdminPanel from '../pages/AdminPanel';

export const ALL_ROUTES = [
    {
        path: '/user',
        label: 'User Hub',
        component: UserHub,
        permission: 'view:user_hub',
        isNav: true
    },
    {
        path: '/chat',
        label: 'Chat Console',
        component: Chat,
        permission: 'view:chat',
        isNav: true
    },
    {
        path: '/documents',
        label: 'Documents',
        component: Documents,
        permission: 'manage:documents',
        isNav: true
    },
    {
        path: '/lancedb-manager',
        label: 'LanceDB Manager',
        component: LanceDBManager,
        permission: 'manage:lancedb',
        isNav: true
    },
    {
        path: '/dashboard',
        label: 'Dashboard',
        component: Dashboard,
        permission: 'view:dashboard',
        isNav: true
    },
    {
        path: '/admin-panel',
        label: 'Admin Panel',
        component: AdminPanel,
        permission: 'manage:system',
        isNav: true
    }
];