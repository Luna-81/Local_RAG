// backend/router/chatRouter.js
const express = require('express');
const ConversationModel = require('../models/ConversationModel');
const QAStatsModel = require('../models/QAStatsModel');
const { authenticate } = require('../middleware/authMiddleware');
const axios = require('axios');

const router = express.Router();
const PYTHON_API = 'http://localhost:5001';

router.use(authenticate);

const getUserId = (req) => (req.user && req.user.id ? req.user.id : 'anonymous');

/**
 * POST /api/chat/ask
 * LEGACY: superseded by /api/qa/ask.
 * Kept for backward compatibility; not used by the UI.
 */
router.post('/ask', async (req, res) => {
    const { question } = req.body;
    const userId = getUserId(req);

    if (!question || !question.trim()) {
        return res.status(400).json({ success: false, message: 'Question is required' });
    }

    console.log(`[Chat] User ${userId}: "${question.substring(0, 50)}..."`);

    try {
        const response = await axios.post(
            `${PYTHON_API}/ask`,
            { question: question.trim() },
            {
                timeout: 30000,
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.data && response.data.success) {
            QAStatsModel.record(userId, question);
            return res.json({
                success: true,
                answer: response.data.answer
            });
        } else {
            return res.status(500).json({
                success: false,
                message: (response.data && response.data.error) || 'Python service error'
            });
        }
    } catch (error) {
        console.error('[Chat] Error:', error.message);
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, message: 'Request timeout (30s)' });
        }
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ success: false, message: 'Python service unavailable' });
        }
        return res.status(500).json({ success: false, message: 'Failed to get answer', error: error.message });
    }
});

/**
 * GET /api/chat/conversations?kbId=1
 * List conversations, optionally scoped to a knowledge base.
 */
router.get(['/conversations', '/'], (req, res) => {
    try {
        const userId = getUserId(req);
        const kbId = req.query.kbId ? Number(req.query.kbId) : null;
        const list = ConversationModel.findByUserId(userId, kbId);
        res.json({ success: true, conversations: list });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/chat/conversations
 * body: { title?, kbId }
 * kbId is required — conversations must belong to a knowledge base.
 */
router.post(['/conversations', '/'], (req, res) => {
    try {
        const userId = getUserId(req);
        const { title = 'New Conversation', kbId } = req.body;

        if (!kbId) {
            return res.status(400).json({
                success: false,
                message: 'kbId is required to create a conversation'
            });
        }

        const newConversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        ConversationModel.save(newConversationId, userId, title, [], Number(kbId));

        res.json({
            success: true,
            conversation: {
                id: newConversationId,
                name: title,
                title: title,
                user_id: userId,
                messages: [],
                isPinned: 0,
                kbId: Number(kbId),
                updatedAt: new Date().toISOString()
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/chat/conversations/:id
 */
router.get(['/conversations/:id', '/:id'], (req, res) => {
    try {
        const userId = getUserId(req);
        const conversation = ConversationModel.findById(req.params.id);

        if (!conversation || conversation.user_id !== userId) {
            return res.status(404).json({ success: false, message: 'Conversation not found.' });
        }

        res.json({ success: true, conversation });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/chat/conversations/:id/rename
 */
router.put(['/conversations/:id/rename', '/:id/rename'], (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { name, title } = req.body;
        const newTitle = name || title;

        if (!newTitle || !newTitle.trim()) {
            return res.status(400).json({ success: false, message: 'New title is required' });
        }

        const updated = ConversationModel.updateTitle(id, userId, newTitle.trim());
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Conversation not found or unauthorized.' });
        }

        res.json({ success: true, message: 'Renamed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/chat/conversations/:id/pin
 */
router.put(['/conversations/:id/pin', '/:id/pin'], (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;
        const { isPinned } = req.body;

        const updated = ConversationModel.togglePin(id, userId, isPinned);
        if (!updated) {
            return res.status(404).json({ success: false, message: 'Conversation not found or unauthorized.' });
        }

        res.json({ success: true, message: `Conversation ${isPinned ? 'pinned' : 'unpinned'} successfully.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/chat/conversations/:id
 */
router.delete(['/conversations/:id', '/:id'], (req, res) => {
    try {
        const userId = getUserId(req);
        const { id } = req.params;

        const deleted = ConversationModel.delete(id, userId);
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Conversation not found or unauthorized.' });
        }

        res.json({ success: true, message: 'Conversation deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/chat/send
 * body: { conversationId, title, messages, question?, kbId? }
 * kbId only matters on first insert (see ConversationModel.save).
 */
router.post('/send', (req, res) => {
    const userId = getUserId(req);
    const { conversationId, title, messages, question, kbId } = req.body;

    if (!conversationId || !messages) {
        return res.status(400).json({ success: false, message: 'Missing conversation parameters.' });
    }

    try {
        const messagesArray = Array.isArray(messages) ? messages : [];

        ConversationModel.save(
            conversationId,
            userId,
            title || 'New Conversation',
            messagesArray,
            kbId ? Number(kbId) : null
        );

        if (question) {
            QAStatsModel.record(userId, question);
        }

        res.json({ success: true, message: 'Conversation updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;