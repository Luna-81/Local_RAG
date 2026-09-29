// src/api/kbApi.js
import api from './indexApi';

export const listKbApi = async () => {
    const { data } = await api.get('/kb');
    return data;
};

export const createKbApi = async (name, description = '') => {
    const { data } = await api.post('/kb', { name, description });
    return data;
};

export const updateKbApi = async (id, payload) => {
    // payload: { name?, description? }
    const { data } = await api.patch(`/kb/${id}`, payload);
    return data;
};

export const deleteKbApi = async (id) => {
    const { data } = await api.delete(`/kb/${id}`);
    return data;
};