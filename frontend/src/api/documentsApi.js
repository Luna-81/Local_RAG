// src/api/documentsApi.js
import api from './indexApi';

export const getDocumentsApi = async (kbId) => {
    const { data } = await api.get('/documents', {
        params: kbId ? { kbId } : {}
    });
    return data;
};

export const uploadDocumentApi = async (
    file,
    chunkSize,
    overlap,
    kbId,
    onProgress
) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('kbId', kbId);
    if (chunkSize) formData.append('chunk_size', chunkSize);
    if (overlap) formData.append('overlap', overlap);

    const { data } = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
            if (e.total && typeof onProgress === 'function') {
                onProgress(Math.round((e.loaded * 100) / e.total));
            }
        }
    });
    return data;
};

export const deleteDocumentApi = async (id) => {
    const { data } = await api.delete(`/documents/${encodeURIComponent(id)}`);
    return data;
};