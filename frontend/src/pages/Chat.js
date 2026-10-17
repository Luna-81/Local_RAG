import React from 'react';
import ChatHeader from '../components/chat/ChatHeader';
import ChatInput from '../components/chat/ChatInput';
import ChatList from '../components/chat/ChatList';
import ChatMessages from '../components/chat/ChatMessages';
import NewChatModal from '../components/chat/NewChatModal';
import useChatController from '../hooks/useChatController';
import '../css/Chat.css';

function Chat() {
  const chat = useChatController();

  return (
    <div className="chat-page-container">
      <aside className="chat-sidebar">
        <ChatList
          conversations={chat.conversations}
          currentChat={chat.currentChat}
          onSelectChat={chat.handleSelectChat}
          onNewChat={() => chat.setShowNewChatModal(true)}
          onRenameChat={chat.handleRenameChat}
          onDeleteChat={chat.handleDeleteChat}
          onTogglePin={chat.handleTogglePin}
        />
      </aside>

      <main className="chat-main">
        {!chat.currentChat ? (
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <p>Select a conversation or start a new one</p>
          </div>
        ) : (
          <>
            <ChatHeader
              chat={chat.currentChat}
              isEditing={chat.isEditingHeader}
              headerName={chat.headerName}
              onChangeHeaderName={chat.setHeaderName}
              onSubmitRename={chat.handleHeaderRenameSubmit}
              onStartEdit={() => chat.setIsEditingHeader(true)}
              onCancelEdit={() => chat.setIsEditingHeader(false)}
            />
            <ChatMessages messages={chat.messages} loading={chat.isCurrentChatLoading} />
            <ChatInput onAsk={chat.handleAsk} disabled={chat.isCurrentChatLoading} />
          </>
        )}
      </main>

      {chat.showNewChatModal && (
        <NewChatModal
          kbList={chat.kbList}
          onClose={() => chat.setShowNewChatModal(false)}
          onCreate={chat.handleCreateChatWithKb}
        />
      )}
    </div>
  );
}

export default Chat;
