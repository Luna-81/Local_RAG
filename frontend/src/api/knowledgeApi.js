// src/api/knowledgeApi.js
import api from './indexApi';

export const listVectorDocsApi = (kbId) =>
    api.get('/knowledge/documents', { params: { kbId } }).then(r => r.data);

export const getKnowledgeMapApi = (docName, kbId) =>
    api
        .get(`/knowledge/map/${encodeURIComponent(docName)}`, { params: { kbId } })
        .then(r => r.data);

export const buildKnowledgeMapApi = (docName, kbId) =>
    api
        .post(`/knowledge/map/${encodeURIComponent(docName)}`, { kbId })
        .then(r => r.data);
