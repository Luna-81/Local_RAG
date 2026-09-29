// src/api/chatApi.js
import api from './indexApi';

// ---------- Conversation management ----------
export const getConversationsApi = async (kbId) => {
    const { data } = await api.get('/chat/conversations', {
        params: kbId ? { kbId } : {}
    });
    return data;
};

export const getConversationByIdApi = async (id) => {
    const { data } = await api.get(`/chat/conversations/${id}`);
    return data;
};

export const createConversationApi = async (title = 'New Conversation', kbId) => {
    const { data } = await api.post('/chat/conversations', { title, kbId });
    return data;
};

export const renameConversationApi = async (id, name) => {
    const { data } = await api.put(`/chat/conversations/${id}/rename`, { name });
    return data;
};

export const deleteConversationApi = async (id) => {
    const { data } = await api.delete(`/chat/conversations/${id}`);
    return data;
};

export const togglePinConversationApi = async (id, isPinned) => {
    const { data } = await api.put(`/chat/conversations/${id}/pin`, { isPinned });
    return data;
};

// ---------- Messages / QA ----------
export const sendMessageApi = async (conversationId, title, messages, question, kbId) => {
    const { data } = await api.post('/chat/send', {
        conversationId, title, messages, question, kbId
    });
    return data;
};

// QA now goes through /qa/ask (spawned ask.py) so KB_TABLE can be injected.
export const askQuestionApi = async (question, kbId) => {
    const { data } = await api.post('/qa/ask', { question, kbId });
    return data;
};