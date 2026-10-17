import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearAuditLogsApi,
  createUserApi,
  deleteUserApi,
  getAuditLogsApi,
  getQAStatsApi,
  getUsersApi,
  updateUserApi,
  updateUserLevelApi,
} from '../api/adminApi';

export default function useAdminPanelController(activeTab) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState([]);
  const [logs, setLogs] = useState({ rows: [], total: 0, page: 1, limit: 50 });
  const [filters, setFilters] = useState({ username: '', path: '', status: '' });
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', user_type: 1 });

  const loadUsers = useCallback(async () => {
    try {
      const response = await getUsersApi();
      if (response.success) setUsers(response.users);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to fetch user list.');
    }
  }, []);

  const loadQAStats = useCallback(async () => {
    try {
      const response = await getQAStatsApi();
      if (response.success) setStats(response.stats);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to fetch QA stats.');
    }
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 50 };
      const activeFilters = filtersRef.current;
      if (activeFilters.username) params.username = activeFilters.username;
      if (activeFilters.path) params.path = activeFilters.path;
      if (activeFilters.status) params.status = activeFilters.status;
      const response = await getAuditLogsApi(params);
      if (response.success) {
        setLogs({
          rows: response.rows,
          total: response.total,
          page: response.page,
          limit: response.limit,
        });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to fetch audit logs.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadUsers(), loadQAStats()]);
      setLoading(false);
    })();
  }, [loadQAStats, loadUsers]);

  useEffect(() => {
    if (activeTab === 'logs') loadLogs(1);
  }, [activeTab, loadLogs]);

  const handleUserTypeChange = async (userId, newType) => {
    try {
      await updateUserLevelApi(userId, Number(newType));
      await loadUsers();
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Failed to update user type.');
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ username: '', password: '', user_type: 1 });
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    setEditingUser(user);
    setUserForm({ username: user.username, password: '', user_type: user.user_type });
    setShowUserModal(true);
  };

  const submitUserForm = async () => {
    try {
      if (editingUser) {
        const payload = { user_type: Number(userForm.user_type) };
        if (userForm.password) payload.password = userForm.password;
        await updateUserApi(editingUser.id, payload);
      } else {
        await createUserApi({
          username: userForm.username,
          password: userForm.password,
          user_type: Number(userForm.user_type),
        });
      }
      setShowUserModal(false);
      await loadUsers();
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Save failed.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user '${user.username}'? This cannot be undone.`)) return;
    try {
      await deleteUserApi(user.id);
      await loadUsers();
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Delete failed.');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Clear ALL audit logs? This cannot be undone.')) return;
    try {
      await clearAuditLogsApi();
      await loadLogs(1);
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Clear failed.');
    }
  };

  return {
    error,
    filters,
    handleClearLogs,
    handleDeleteUser,
    handleUserTypeChange,
    loadLogs,
    loading,
    logs,
    openCreateUser,
    openEditUser,
    setFilters,
    setShowUserModal,
    setUserForm,
    showUserModal,
    stats,
    submitUserForm,
    userForm,
    users,
    editingUser,
  };
}
