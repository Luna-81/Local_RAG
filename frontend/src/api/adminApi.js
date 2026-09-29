// src/api/adminApi.js
import api from './indexApi';

// ---------- User management ----------
export const getUsersApi = async () => {
    const { data } = await api.get('/admin/users');
    return data;
};

export const createUserApi = async (payload) => {
    const { data } = await api.post('/admin/users', payload);
    return data;
};

export const updateUserApi = async (id, payload) => {
    const { data } = await api.put(`/admin/users/${id}`, payload);
    return data;
};

export const updateUserLevelApi = async (id, level) => {
    const { data } = await api.put(`/admin/users/${id}/role`, { user_type: level });
    return data;
};

export const deleteUserApi = async (id) => {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
};

// ---------- QA statistics ----------
export const getQAStatsApi = async () => {
    const { data } = await api.get('/admin/qa-stats');
    return data;
};

// ---------- Audit logs ----------
export const getAuditLogsApi = async (params = {}) => {
    const { data } = await api.get('/admin/logs', { params });
    return data;
};

export const clearAuditLogsApi = async () => {
    const { data } = await api.delete('/admin/logs');
    return data;
};
