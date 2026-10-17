import { useEffect, useState } from 'react';
import { askQuestionApi, sendMessageApi } from '../api/chatApi';
import { getChatId, parseMessages } from '../utils/chat';

export default function useChatMessages({
  currentChat,
  setCurrentChat,
  setConversations,
  onRenameChat,
}) {
  const [messages, setMessages] = useState([]);
  const [loadingChatId, setLoadingChatId] = useState(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [headerName, setHeaderName] = useState('');

  const currentChatId = getChatId(currentChat);
  const isCurrentChatLoading = loadingChatId !== null && loadingChatId === currentChatId;

  useEffect(() => {
    if (currentChat) {
      setMessages(parseMessages(currentChat.messages));
      setHeaderName(currentChat.name || currentChat.title || 'New Conversation');
      setIsEditingHeader(false);
    } else {
      setMessages([]);
    }
  }, [currentChat]);

  const handleSelectChat = (chat) => {
    if (!chat) return;
    setCurrentChat(chat);
    setMessages(parseMessages(chat.messages));
  };

  const handleAsk = async (question) => {
    const trimmedQuestion = question.trim();
    if (!currentChat || !trimmedQuestion || isCurrentChatLoading) return;

    const chatKbId = currentChat.kbId;
    if (!chatKbId) {
      alert('This conversation has no knowledge base attached.');
      return;
    }

    const targetChatId = getChatId(currentChat);
    const updatedMessages = [
      ...parseMessages(currentChat.messages),
      { text: trimmedQuestion, isUser: true },
    ];
    setMessages(updatedMessages);
    setLoadingChatId(targetChatId);
    setConversations((previous) =>
      previous.map((conversation) =>
        getChatId(conversation) === targetChatId
          ? { ...conversation, messages: updatedMessages, updatedAt: new Date().toISOString() }
          : conversation,
      ),
    );
    setCurrentChat((previous) =>
      getChatId(previous) === targetChatId ? { ...previous, messages: updatedMessages } : previous,
    );

    try {
      const response = await askQuestionApi(trimmedQuestion, chatKbId);
      const finalMessages = [
        ...updatedMessages,
        {
          text: response?.answer || response?.reply || response?.text || 'No response generated.',
          isUser: false,
        },
      ];

      setMessages(finalMessages);
      setCurrentChat((previous) =>
        getChatId(previous) === targetChatId ? { ...previous, messages: finalMessages } : previous,
      );
      setConversations((previous) =>
        previous.map((conversation) =>
          getChatId(conversation) === targetChatId
            ? { ...conversation, messages: finalMessages, updatedAt: new Date().toISOString() }
            : conversation,
        ),
      );

      try {
        await sendMessageApi(
          targetChatId,
          currentChat.name || 'New Conversation',
          finalMessages,
          trimmedQuestion,
          chatKbId,
        );
      } catch (error) {
        console.error('Failed to persist conversation:', error);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages((previous) => [
        ...previous,
        { text: 'Error: Failed to obtain response from backend server.', isUser: false },
      ]);
    } finally {
      setLoadingChatId(null);
    }
  };

  const handleHeaderRenameSubmit = () => {
    const trimmedName = headerName.trim();
    const currentName = currentChat?.name || currentChat?.title || '';
    const chatId = getChatId(currentChat);
    if (trimmedName && trimmedName !== currentName && chatId) {
      onRenameChat(chatId, trimmedName);
    } else {
      setHeaderName(currentName);
    }
    setIsEditingHeader(false);
  };

  return {
    messages,
    isCurrentChatLoading,
    isEditingHeader,
    headerName,
    setIsEditingHeader,
    setHeaderName,
    handleAsk,
    handleHeaderRenameSubmit,
    handleSelectChat,
  };
}
