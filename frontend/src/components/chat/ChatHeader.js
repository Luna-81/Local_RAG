// src/components/ChatHeader.js
import React from 'react';

function ChatHeader({
  chat,
  isEditing,
  headerName,
  onChangeHeaderName,
  onSubmitRename,
  onStartEdit,
  onCancelEdit,
}) {
  const displayName = chat?.name || chat?.title || 'New Conversation';

  if (!chat) return null;

  return (
    <div className="chat-header">
      {isEditing ? (
        <div className="chat-header-edit">
          <input
            type="text"
            className="chat-header-input"
            value={headerName}
            onChange={(e) => onChangeHeaderName(e.target.value)}
            onBlur={onSubmitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmitRename();
              if (e.key === 'Escape') onCancelEdit();
            }}
            autoFocus
          />
        </div>
      ) : (
        <div className="chat-header-name-container">
          <span className="chat-header-name">💬 {displayName}</span>
          <button
            className="rename-btn"
            onClick={onStartEdit}
            title="Rename conversation"
          >
            ✏️
          </button>
        </div>
      )}
    </div>
  );
}

export default ChatHeader;