// src/api/authApi.js
import api from './indexApi';

// ---------- 认证 ----------
export const loginApi = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
};

export const getMeApi = async () => {
    const { data } = await api.get('/auth/me');
    return data;
};

//---------- 用户管理 ----------
export const getUsersApi = async () => {
    const { data } = await api.get('/admin/users');
    return data;
};

export const updateUserLevelApi = async (id, level) => {
    const { data } = await api.put(`/admin/users/${id}/role`, { user_type: level });
    return data;
};

export const getQAStatsApi = async () => {
    const { data } = await api.get('/admin/qa-stats');
    return data;
};

// ---------- 向量库维护 ----------
export const getVectorIndexStatsApi = async () => {
    const { data } = await api.get('/lancedb/stats');
    return data;
};

export const clearVectorTableApi = async (tableName) => {
    const { data } = await api.post('/lancedb/clear-table', { tableName });
    return data;
};

// ---------- 用户 CRUD ----------
export const createUserApi = async (payload) => {
    const { data } = await api.post('/admin/users', payload);
    return data;
};

export const updateUserApi = async (id, payload) => {
    const { data } = await api.put(`/admin/users/${id}`, payload);
    return data;
};

export const deleteUserApi = async (id) => {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
};

// ---------- 审计日志 ----------
export const getAuditLogsApi = async (params = {}) => {
    const { data } = await api.get('/admin/logs', { params });
    return data;
};

export const clearAuditLogsApi = async () => {
    const { data } = await api.delete('/admin/logs');
    return data;
};