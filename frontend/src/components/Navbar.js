// frontend/src/components/Navbar.js
import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';   // ⭐ 加 useLocation
import { ALL_ROUTES } from '../config/routes';

const Navbar = ({ user, onLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();                                    // ⭐ 拿当前路径
    const userPermissions = user?.permissions || [];

    // 根据权限列表过滤显示的菜单
    const navItems = ALL_ROUTES.filter(
        (route) => route.isNav && userPermissions.includes(route.permission)
    );

    const handleLogoutClick = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        onLogout();
        navigate('/login');
    };

    return (
        <nav style={styles.nav}>
            <div style={styles.brand}>System Hub</div>
            <div style={styles.links}>
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;   // ⭐ 当前页判断
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            style={isActive ? styles.linkActive : styles.link}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
            <div style={styles.userSection}>
                <span style={styles.userInfo}>{user?.username}</span>
                <button onClick={handleLogoutClick} style={styles.logoutBtn}>
                    Logout
                </button>
            </div>
        </nav>
    );
};

const styles = {
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 2rem',
        background: '#0f172a',
        color: '#fff'
    },
    brand: {
        fontSize: '1.2rem',
        fontWeight: 'bold'
    },
    links: {
        display: 'flex',
        gap: '1.5rem'
    },
    link: {
        color: '#e2e8f0',
        textDecoration: 'none',
        fontWeight: '500',
        transition: 'color 0.15s'
    },
    // ⭐ 当前页高亮：金色
    linkActive: {
        color: '#fde68a',            
        textDecoration: 'none',
        fontWeight: '700',
        transition: 'color 0.15s'
    },
    userSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
    },
    userInfo: {
        fontSize: '0.9rem',
        color: '#94a3b8'
    },
    logoutBtn: {
        padding: '0.4rem 0.8rem',
        background: '#ef4444',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    }
};

export default Navbar;