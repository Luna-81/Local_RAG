// src/api/indexApi.js
import axios from 'axios';
import { getAccessToken, clearAccessToken } from './authSession';

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' }
});

// 自动带 JWT
api.interceptors.request.use(
    (config) => {
        const token = getAccessToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// 401 自动跳登录；403 保留当前登录状态
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        if (status === 401) {
            clearAccessToken();
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
