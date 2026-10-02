import React, { useEffect, useState } from 'react';
import {
    getUsersApi, updateUserLevelApi, getQAStatsApi,
    createUserApi, updateUserApi, deleteUserApi,
    getAuditLogsApi, clearAuditLogsApi,
} from '../api/adminApi';
import XdpPanel from '../components/xdp/XdpPanel';             
import '../css/AdminPanel.css';

const AdminPanel = () => {
    const [activeTab, setActiveTab] = useState('users');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [users, setUsers] = useState([]);
    const [showUserModal, setShowUserModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({ username: '', password: '', user_type: 1 });

    const [stats, setStats] = useState([]);

    const [logs, setLogs] = useState({ rows: [], total: 0, page: 1, limit: 50 });
    const [filters, setFilters] = useState({ username: '', path: '', status: '' });

    const loadUsers = async () => {
        try {
            const res = await getUsersApi();
            if (res.success) setUsers(res.users);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch user list.');
        }
    };

    const loadQAStats = async () => {
        try {
            const res = await getQAStatsApi();
            if (res.success) setStats(res.stats);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch QA stats.');
        }
    };

    const loadLogs = async (page = 1) => {
        try {
            const params = { page, limit: 50 };
            if (filters.username) params.username = filters.username;
            if (filters.path)     params.path = filters.path;
            if (filters.status)   params.status = filters.status;
            const res = await getAuditLogsApi(params);
            if (res.success) {
                setLogs({ rows: res.rows, total: res.total, page: res.page, limit: res.limit });
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch audit logs.');
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([loadUsers(), loadQAStats()]);
            setLoading(false);
        })();
    }, []);

    useEffect(() => {
        if (activeTab === 'logs') loadLogs(1);
        // eslint-disable-next-line
    }, [activeTab]);

    const handleUserTypeChange = async (userId, newType) => {
        try {
            await updateUserLevelApi(userId, Number(newType));
            await loadUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update user type.');
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
        } catch (err) {
            alert(err.response?.data?.message || 'Save failed.');
        }
    };

    const handleDeleteUser = async (user) => {
        if (!window.confirm(`Delete user '${user.username}'? This cannot be undone.`)) return;
        try {
            await deleteUserApi(user.id);
            await loadUsers();
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed.');
        }
    };

    const handleClearLogs = async () => {
        if (!window.confirm('Clear ALL audit logs? This cannot be undone.')) return;
        try {
            await clearAuditLogsApi();
            await loadLogs(1);
        } catch (err) {
            alert(err.response?.data?.message || 'Clear failed.');
        }
    };

    if (loading) return <div className="page-container">Loading control panel...</div>;

    return (
        <div className="page-container">
            <h2>System Control Panel</h2>
            {error && <p className="error-msg">{error}</p>}

            <div className="tab-navigation">
                <button className={activeTab === 'users' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveTab('users')}>
                    Account Management
                </button>
                <button className={activeTab === 'logs' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveTab('logs')}>
                    System Audit Log
                </button>
                <button className={activeTab === 'qa' ? 'tab-btn active' : 'tab-btn'}
                        onClick={() => setActiveTab('qa')}>
                    Question Analytics
                </button>
                <button className={activeTab === 'xdp' ? 'tab-btn active' : 'tab-btn'}  
                        onClick={() => setActiveTab('xdp')}>
                    XDP Firewall
                </button>
            </div>

            {activeTab === 'users' && (
                <>
                    <div style={{ marginBottom: 12 }}>
                        <button className="tab-btn" onClick={openCreateUser}>+ New User</button>
                    </div>
                    <div className="table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Username</th>
                                    <th>User Level</th>
                                    <th>Created At</th>
                                    <th>Permission</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>{user.username}</td>
                                        <td>Level {user.user_type}</td>
                                        <td>{new Date(user.created_at).toLocaleString()}</td>
                                        <td>
                                            <select value={user.user_type}
                                                    onChange={(e) => handleUserTypeChange(user.id, e.target.value)}>
                                                <option value={1}>Level 1</option>
                                                <option value={2}>Level 2</option>
                                                <option value={3}>Level 3</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button onClick={() => openEditUser(user)}>Edit</button>
                                            {' '}
                                            <button className="btn-danger" onClick={() => handleDeleteUser(user)}>
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {activeTab === 'logs' && (
                <>
                    <div className="filter-bar">
                        <input placeholder="Username" value={filters.username}
                               onChange={e => setFilters({ ...filters, username: e.target.value })} />
                        <input placeholder="Path contains…" value={filters.path}
                               onChange={e => setFilters({ ...filters, path: e.target.value })} />
                        <select value={filters.status}
                                onChange={e => setFilters({ ...filters, status: e.target.value })}>
                            <option value="">All status</option>
                            <option value="200">200 OK</option>
                            <option value="400">400 Bad Request</option>
                            <option value="401">401 Unauthorized</option>
                            <option value="403">403 Forbidden</option>
                            <option value="404">404 Not Found</option>
                            <option value="500">500 Server Error</option>
                        </select>
                        <button onClick={() => loadLogs(1)}>Search</button>
                        <button className="btn-danger" style={{ marginLeft: 'auto' }}
                                onClick={handleClearLogs}>Clear All</button>
                    </div>

                    <div className="table-wrapper">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Method</th>
                                    <th>Path</th>
                                    <th>Status</th>
                                    <th>IP</th>
                                    <th>ms</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.rows.length === 0 ? (
                                    <tr><td colSpan="8" style={{ textAlign: 'center' }}>No audit records.</td></tr>
                                ) : logs.rows.map(r => (
                                    <tr key={r.id}>
                                        <td>{r.id}</td>
                                        <td>{new Date(r.created_at).toLocaleString()}</td>
                                        <td>{r.username || '-'}</td>
                                        <td>{r.method}</td>
                                        <td style={{ wordBreak: 'break-all' }}>{r.path}</td>
                                        <td style={{ color: r.status >= 400 ? '#dc2626' : '#16a34a' }}>
                                            {r.status}
                                        </td>
                                        <td>{r.ip || '-'}</td>
                                        <td>{r.duration_ms}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="pagination">
                        <span>Total {logs.total} records</span>
                        <button disabled={logs.page <= 1} onClick={() => loadLogs(logs.page - 1)}>← Prev</button>
                        <span>Page {logs.page} / {Math.max(1, Math.ceil(logs.total / logs.limit))}</span>
                        <button disabled={logs.page * logs.limit >= logs.total}
                                onClick={() => loadLogs(logs.page + 1)}>Next →</button>
                    </div>
                </>
            )}

            {activeTab === 'qa' && (
                <div className="table-wrapper">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Question</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No QA history.</td></tr>
                            ) : stats.map(item => (
                                <tr key={item.id}>
                                    <td>{item.id}</td>
                                    <td>{item.username}</td>
                                    <td>{item.question}</td>
                                    <td>{new Date(item.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ⭐ 新增：XDP Tab 内容 */}
            {activeTab === 'xdp' && <XdpPanel />}

            {showUserModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h3>{editingUser ? `Edit '${editingUser.username}'` : 'New User'}</h3>
                        {!editingUser && (
                            <p><label>Username<br />
                                <input value={userForm.username}
                                       onChange={e => setUserForm({ ...userForm, username: e.target.value })} />
                            </label></p>
                        )}
                        <p><label>{editingUser ? 'New password (leave empty to keep)' : 'Password'}<br />
                            <input type="password" value={userForm.password}
                                   onChange={e => setUserForm({ ...userForm, password: e.target.value })} />
                        </label></p>
                        <p><label>Role<br />
                            <select value={userForm.user_type}
                                    onChange={e => setUserForm({ ...userForm, user_type: e.target.value })}>
                                <option value={1}>Level 1 - Standard</option>
                                <option value={2}>Level 2 - AI Operator</option>
                                <option value={3}>Level 3 - System Admin</option>
                            </select>
                        </label></p>
                        <div className="modal-actions">
                            <button onClick={() => setShowUserModal(false)}>Cancel</button>
                            <button className="tab-btn active" onClick={submitUserForm}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;