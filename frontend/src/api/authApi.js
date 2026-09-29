// src/api/authApi.js
import api from './indexApi';

// ---------- Authentication ----------
export const loginApi = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    return data;
};

export const getMeApi = async () => {
    const { data } = await api.get('/auth/me');
    return data;
};
