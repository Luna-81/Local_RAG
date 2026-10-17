// frontend/src/components/Navbar.js
import React from 'react';
import { logoutApi } from '../../api/authApi';
import { clearAccessToken } from '../../api/authSession';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ALL_ROUTES } from '../../config/routes';
import '../../css/Navbar.css';

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const userPermissions = user?.permissions || [];

  // Show only routes allowed by the current user's permissions.
  const navItems = ALL_ROUTES.filter(
    (route) => route.isNav && userPermissions.includes(route.permission),
  );

  const handleLogoutClick = async () => {
    try {
      await logoutApi();
    } catch (error) {
      if (error.response?.status !== 401) {
        window.alert('Logout failed. Please try again.');
        return;
      }
    }
    clearAccessToken();
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="app-navbar">
      <div className="app-navbar-brand">System Hub</div>
      <div className="app-navbar-links">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`app-navbar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="app-navbar-user">
        <span className="app-navbar-username">{user?.username}</span>
        <button onClick={handleLogoutClick} className="app-navbar-logout">
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
