// src/components/ChatList.js
import React, { useState } from 'react';
import '../css/Chat.css';

function ChatList({
    conversations = [],
    currentChat,
    onSelectChat,
    onNewChat,
    onRenameChat,
    onDeleteChat,
    onTogglePin
}) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const getChatId = (chat) => chat?.id || chat?._id;

    const getParsedMessages = (msgs) => {
        if (!msgs) return [];
        if (typeof msgs === 'string') {
            try {
                return JSON.parse(msgs);
            } catch {
                return [];
            }
        }
        return Array.isArray(msgs) ? msgs : [];
    };

    const formatTime = (date) => {
        if (!date) return '';
        const d = new Date(date);
        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getLastMessage = (msgsInput) => {
        const msgs = getParsedMessages(msgsInput);
        if (msgs.length === 0) return 'No messages';
        const last = msgs[msgs.length - 1];
        const text = last?.text || last?.content || '';
        return text.length > 35 ? `${text.substring(0, 35)}...` : text;
    };

    const getMessageCount = (msgsInput) => getParsedMessages(msgsInput).length;

    const handleStartRename = (conv, e) => {
        e.stopPropagation();
        setEditingId(getChatId(conv));
        setEditName(conv.name || conv.title || '');
    };

    const handleSaveRename = (conv, e) => {
        if (e) e.stopPropagation();
        const id = getChatId(conv);
        const trimmed = editName.trim();
        const currentName = conv.name || conv.title || '';

        if (trimmed && trimmed !== currentName && onRenameChat) {
            onRenameChat(id, trimmed);
        }
        setEditingId(null);
    };

    const handleKeyDown = (conv, e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveRename(conv, e);
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    const sortedConversations = [...conversations].sort((a, b) => {
        const pinA = Boolean(a.isPinned);
        const pinB = Boolean(b.isPinned);
        if (pinA === pinB) return 0;
        return pinA ? -1 : 1;
    });

    return (
        <div className="chat-list">
            <div className="chat-list-header">
                <span className="chat-list-title">💬 Conversations</span>
                <button className="btn-new-chat" onClick={onNewChat}>
                    ➕ New
                </button>
            </div>

            <div className="chat-list-items">
                {sortedConversations.length === 0 ? (
                    <div className="chat-list-empty">
                        <p>No conversations yet</p>
                        <span className="hint">Click + New to start</span>
                    </div>
                ) : (
                    sortedConversations.map((conv, index) => {
                        const chatId = getChatId(conv);
                        const isEditing = editingId === chatId;
                        const isActive = currentChat && getChatId(currentChat) === chatId;
                        const displayName = conv.name || conv.title || 'Untitled';

                        return (
                            <div
                                key={chatId || `chat-item-${index}`}
                                className={`chat-list-item ${isActive ? 'active' : ''} ${conv.isPinned ? 'pinned' : ''}`}
                                onClick={() => onSelectChat(conv)}
                            >
                                <div className="chat-item-icon">{conv.isPinned ? '📍' : '💬'}</div>
                                <div className="chat-item-info">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            className="chat-item-rename-input"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onBlur={(e) => handleSaveRename(conv, e)}
                                            onKeyDown={(e) => handleKeyDown(conv, e)}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <div className="chat-item-name-row">
                                            <div className="chat-item-name">{displayName}</div>
                                            {conv.kbName && (
                                                <span className="chat-item-kb" title={`KB: ${conv.kbName}`}>
                                                    {conv.kbName}
                                                </span>
                                            )}
                                            <div className="chat-item-actions">
                                                <button
                                                    type="button"
                                                    className="btn-action-icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTogglePin && onTogglePin(chatId);
                                                    }}
                                                    title={conv.isPinned ? 'Unpin' : 'Pin to top'}
                                                >
                                                    {conv.isPinned ? '📌' : '📍'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-action-icon"
                                                    onClick={(e) => handleStartRename(conv, e)}
                                                    title="Rename"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn-action-icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm('Delete this conversation?')) {
                                                            onDeleteChat && onDeleteChat(chatId);
                                                        }
                                                    }}
                                                    title="Delete"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="chat-item-preview">{getLastMessage(conv.messages)}</div>
                                </div>
                                <div className="chat-item-right">
                                    <div className="chat-item-time">{formatTime(conv.updatedAt || conv.updated_at)}</div>
                                    {getMessageCount(conv.messages) > 0 && (
                                        <div className="chat-item-count">{getMessageCount(conv.messages)}</div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default ChatList;