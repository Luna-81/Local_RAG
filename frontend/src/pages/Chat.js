// src/pages/Chat.js
import React, { useEffect, useState, useCallback } from 'react';
import ChatList from '../components/chat/ChatList';
import ChatInput from '../components/chat/ChatInput';
import ChatHeader from '../components/chat/ChatHeader';
import ChatMessages from '../components/chat/ChatMessages';
import NewChatModal from '../components/chat/NewChatModal';
import {
    getConversationsApi,
    createConversationApi,
    renameConversationApi,
    deleteConversationApi,
    togglePinConversationApi,
    askQuestionApi,
    sendMessageApi,
} from '../api/chatApi';
import { listKbApi } from '../api/kbApi';
import '../css/Chat.css';

function Chat() {
    const [conversations, setConversations] = useState([]);
    const [currentChat, setCurrentChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    const [kbList, setKbList] = useState([]);
    const [showNewChatModal, setShowNewChatModal] = useState(false);

    const [isEditingHeader, setIsEditingHeader] = useState(false);
    const [headerName, setHeaderName] = useState('');

    const getChatId = (chat) => chat?.id || chat?._id;

    const parseMessages = useCallback((msgs) => {
        if (!msgs) return [];
        if (typeof msgs === 'string') {
            try {
                return JSON.parse(msgs);
            } catch (e) {
                console.error('Failed to parse JSON messages:', e);
                return [];
            }
        }
        return Array.isArray(msgs) ? msgs : [];
    }, []);

    // ---- Load KB list (for modal + name lookup) ----
    useEffect(() => {
        (async () => {
            try {
                const res = await listKbApi();
                setKbList(res?.knowledgeBases || []);
            } catch (err) {
                console.error('Failed to load KB list:', err);
            }
        })();
    }, []);

    // ---- Load all conversations (no KB filter) ----
    const loadConversations = useCallback(async () => {
        try {
            const res = await getConversationsApi();
            const list = res?.conversations || (Array.isArray(res) ? res : []);

            const kbMap = Object.fromEntries(kbList.map((k) => [k.id, k.name]));

            const normalizedList = list.map((item) => ({
                ...item,
                id: getChatId(item),
                isPinned: Boolean(item.isPinned),
                kbName: kbMap[item.kbId] || '',
                messages: parseMessages(item.messages),
            }));

            setConversations(normalizedList);

            // Keep currentChat if it still exists; otherwise pick the first
            setCurrentChat((prev) => {
                if (prev) {
                    const found = normalizedList.find((c) => getChatId(c) === getChatId(prev));
                    if (found) return found;
                }
                return normalizedList.length > 0 ? normalizedList[0] : null;
            });
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, [kbList, parseMessages]);

    // Load on mount and whenever kbList changes (to fill kbName)
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Sync header/messages when active chat changes
    useEffect(() => {
        if (currentChat) {
            setMessages(parseMessages(currentChat.messages));
            setHeaderName(currentChat.name || currentChat.title || 'New Conversation');
            setIsEditingHeader(false);
        } else {
            setMessages([]);
        }
    }, [currentChat, parseMessages]);

    const handleSelectChat = useCallback((chat) => {
        if (!chat) return;
        setCurrentChat(chat);
        setMessages(parseMessages(chat.messages));
    }, [parseMessages]);

    // ---- New chat: open modal to pick KB ----
    const handleOpenNewChatModal = () => {
        setShowNewChatModal(true);
    };

    const handleCreateChatWithKb = async (kbId) => {
        const defaultTitle = 'New Conversation';
        try {
            const res = await createConversationApi(defaultTitle, kbId);
            const newConv = res?.conversation || res?.chat || res;
            const realId = getChatId(newConv);

            if (newConv && realId) {
                const kbName = kbList.find((k) => k.id === kbId)?.name || '';
                const formattedConv = {
                    ...newConv,
                    id: realId,
                    name: newConv.name || newConv.title || defaultTitle,
                    isPinned: false,
                    kbId,
                    kbName,
                    messages: parseMessages(newConv.messages),
                };
                setConversations((prev) => [formattedConv, ...prev]);
                setCurrentChat(formattedConv);
                setShowNewChatModal(false);
            }
        } catch (err) {
            console.error('Failed to create new conversation:', err);
            alert('Failed to create conversation: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleRenameChat = async (id, newName) => {
        if (!id || !newName) return;
        setConversations((prev) =>
            prev.map((item) => (getChatId(item) === id ? { ...item, name: newName, title: newName } : item))
        );
        if (getChatId(currentChat) === id) {
            setCurrentChat((prev) => ({ ...prev, name: newName, title: newName }));
        }
        try {
            await renameConversationApi(id, newName);
        } catch (err) {
            console.warn('Backend rename did not succeed:', err);
        }
    };

    const handleDeleteChat = async (id) => {
        if (!id) return;
        setConversations((prev) => {
            const updated = prev.filter((item) => getChatId(item) !== id);
            if (getChatId(currentChat) === id) {
                setCurrentChat(updated[0] || null);
            }
            return updated;
        });
        try {
            await deleteConversationApi(id);
        } catch (err) {
            console.warn('Backend delete did not succeed:', err);
        }
    };

    const handleTogglePin = async (id) => {
        if (!id) return;
        const targetChat = conversations.find((item) => getChatId(item) === id);
        const nextPinnedState = targetChat ? !targetChat.isPinned : true;
        setConversations((prev) =>
            prev.map((item) => (getChatId(item) === id ? { ...item, isPinned: nextPinnedState } : item))
        );
        if (getChatId(currentChat) === id) {
            setCurrentChat((prev) => ({ ...prev, isPinned: nextPinnedState }));
        }
        try {
            await togglePinConversationApi(id, nextPinnedState);
        } catch (err) {
            console.warn('Backend pin did not succeed:', err);
        }
    };

    // ---- Ask: uses current chat's kbId ----
    const handleAsk = async (question) => {
        const trimmedQuestion = question.trim();
        if (!currentChat || !trimmedQuestion || loading) return;

        const chatKbId = currentChat.kbId;
        if (!chatKbId) {
            alert('This conversation has no knowledge base attached.');
            return;
        }

        let activeChat = currentChat;
        let targetChatId = getChatId(activeChat);

        const userMsg = { text: trimmedQuestion, isUser: true };
        const updatedMessages = [...messages, userMsg];

        setMessages(updatedMessages);
        setLoading(true);

        setConversations((prev) =>
            prev.map((c) => {
                const cid = getChatId(c);
                if (cid === getChatId(currentChat) || cid === targetChatId) {
                    return {
                        ...c,
                        messages: updatedMessages,
                        updatedAt: new Date().toISOString(),
                    };
                }
                return c;
            })
        );

        try {
            const res = await askQuestionApi(trimmedQuestion, chatKbId);
            const botAnswer = res?.answer || res?.reply || res?.text || 'No response generated.';
            const botMsg = { text: botAnswer, isUser: false };
            const finalMessages = [...updatedMessages, botMsg];

            setMessages(finalMessages);
            setCurrentChat((prev) =>
                getChatId(prev) === targetChatId ? { ...prev, messages: finalMessages } : prev
            );
            setConversations((prev) =>
                prev.map((c) =>
                    getChatId(c) === targetChatId
                        ? { ...c, messages: finalMessages, updatedAt: new Date().toISOString() }
                        : c
                )
            );

            try {
                await sendMessageApi(
                    targetChatId,
                    activeChat.name || 'New Conversation',
                    finalMessages,
                    trimmedQuestion,
                    chatKbId
                );
            } catch (saveErr) {
                console.error('Failed to persist conversation:', saveErr);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            const errorMsg = { text: 'Error: Failed to obtain response from backend server.', isUser: false };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleHeaderRenameSubmit = () => {
        const trimmed = headerName.trim();
        const currentName = currentChat?.name || currentChat?.title || '';
        const chatId = getChatId(currentChat);
        if (trimmed && trimmed !== currentName && chatId) {
            handleRenameChat(chatId, trimmed);
        } else {
            setHeaderName(currentName);
        }
        setIsEditingHeader(false);
    };

    return (
        <div className="chat-page-container">
            <aside className="chat-sidebar">
                <ChatList
                    conversations={conversations}
                    currentChat={currentChat}
                    onSelectChat={handleSelectChat}
                    onNewChat={handleOpenNewChatModal}
                    onRenameChat={handleRenameChat}
                    onDeleteChat={handleDeleteChat}
                    onTogglePin={handleTogglePin}
                />
            </aside>

            <main className="chat-main">
                {!currentChat ? (
                    <div className="empty-state">
                        <div className="empty-icon">💬</div>
                        <p>Select a conversation or start a new one</p>
                    </div>
                ) : (
                    <>
                        <ChatHeader
                            chat={currentChat}
                            isEditing={isEditingHeader}
                            headerName={headerName}
                            onChangeHeaderName={setHeaderName}
                            onSubmitRename={handleHeaderRenameSubmit}
                            onStartEdit={() => setIsEditingHeader(true)}
                            onCancelEdit={() => setIsEditingHeader(false)}
                        />

                        <ChatMessages messages={messages} loading={loading} />

                        <ChatInput onAsk={handleAsk} disabled={loading} />
                    </>
                )}
            </main>

            {showNewChatModal && (
                <NewChatModal
                    kbList={kbList}
                    onClose={() => setShowNewChatModal(false)}
                    onCreate={handleCreateChatWithKb}
                />
            )}
        </div>
    );
}

export default Chat;