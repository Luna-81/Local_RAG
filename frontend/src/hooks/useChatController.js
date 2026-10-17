import { useState } from 'react';
import useChatConversations from './useChatConversations';
import useChatMessages from './useChatMessages';

export default function useChatController() {
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const conversations = useChatConversations();
  const messages = useChatMessages({
    currentChat: conversations.currentChat,
    setCurrentChat: conversations.setCurrentChat,
    setConversations: conversations.setConversations,
    onRenameChat: conversations.handleRenameChat,
  });

  return {
    ...conversations,
    ...messages,
    showNewChatModal,
    setShowNewChatModal,
  };
}
