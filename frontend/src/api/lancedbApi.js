// src/api/lancedbApi.js
import api from './indexApi';

export const getVectorIndexStatsApi = async () => {
    const { data } = await api.get('/lancedb/stats');
    return data;
};

export const clearVectorTableApi = async (tableName) => {
    const { data } = await api.post('/lancedb/clear-table', { tableName });
    return data;
};
