import { useCallback, useEffect, useState } from 'react';
import {
  createConversationApi,
  deleteConversationApi,
  getConversationsApi,
  renameConversationApi,
  togglePinConversationApi,
} from '../api/chatApi';
import { listKbApi } from '../api/kbApi';
import { getChatId, parseMessages } from '../utils/chat';

export default function useChatConversations() {
  const [conversations, setConversations] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [kbList, setKbList] = useState([]);

  useEffect(() => {
    let isMounted = true;
    listKbApi()
      .then((response) => {
        if (isMounted) setKbList(response?.knowledgeBases || []);
      })
      .catch((error) => console.error('Failed to load KB list:', error));
    return () => {
      isMounted = false;
    };
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const response = await getConversationsApi();
      const list = response?.conversations || (Array.isArray(response) ? response : []);
      const kbNames = Object.fromEntries(
        kbList.map((knowledgeBase) => [knowledgeBase.id, knowledgeBase.name]),
      );
      const normalizedList = list.map((conversation) => ({
        ...conversation,
        id: getChatId(conversation),
        isPinned: Boolean(conversation.isPinned),
        kbName: kbNames[conversation.kbId] || '',
        messages: parseMessages(conversation.messages),
      }));

      setConversations(normalizedList);
      setCurrentChat((previousChat) => {
        if (previousChat) {
          const selectedChat = normalizedList.find(
            (conversation) => getChatId(conversation) === getChatId(previousChat),
          );
          if (selectedChat) return selectedChat;
        }
        return normalizedList[0] || null;
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [kbList]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleCreateChatWithKb = async (kbId) => {
    const defaultTitle = 'New Conversation';
    try {
      const response = await createConversationApi(defaultTitle, kbId);
      const conversation = response?.conversation || response?.chat || response;
      const realId = getChatId(conversation);

      if (conversation && realId) {
        const kbName = kbList.find((knowledgeBase) => knowledgeBase.id === kbId)?.name || '';
        const formattedConversation = {
          ...conversation,
          id: realId,
          name: conversation.name || conversation.title || defaultTitle,
          isPinned: false,
          kbId,
          kbName,
          messages: parseMessages(conversation.messages),
        };
        setConversations((previous) => [formattedConversation, ...previous]);
        setCurrentChat(formattedConversation);
      }
    } catch (error) {
      console.error('Failed to create new conversation:', error);
      alert('Failed to create conversation: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRenameChat = async (id, newName) => {
    if (!id || !newName) return;
    setConversations((previous) =>
      previous.map((conversation) =>
        getChatId(conversation) === id
          ? { ...conversation, name: newName, title: newName }
          : conversation,
      ),
    );
    if (getChatId(currentChat) === id) {
      setCurrentChat((previous) => ({ ...previous, name: newName, title: newName }));
    }
    try {
      await renameConversationApi(id, newName);
    } catch (error) {
      console.warn('Backend rename did not succeed:', error);
    }
  };

  const handleDeleteChat = async (id) => {
    if (!id) return;
    setConversations((previous) => {
      const updated = previous.filter((conversation) => getChatId(conversation) !== id);
      if (getChatId(currentChat) === id) setCurrentChat(updated[0] || null);
      return updated;
    });
    try {
      await deleteConversationApi(id);
    } catch (error) {
      console.warn('Backend delete did not succeed:', error);
    }
  };

  const handleTogglePin = async (id) => {
    if (!id) return;
    const targetChat = conversations.find((conversation) => getChatId(conversation) === id);
    const nextPinnedState = targetChat ? !targetChat.isPinned : true;
    setConversations((previous) =>
      previous.map((conversation) =>
        getChatId(conversation) === id
          ? { ...conversation, isPinned: nextPinnedState }
          : conversation,
      ),
    );
    if (getChatId(currentChat) === id) {
      setCurrentChat((previous) => ({ ...previous, isPinned: nextPinnedState }));
    }
    try {
      await togglePinConversationApi(id, nextPinnedState);
    } catch (error) {
      console.warn('Backend pin did not succeed:', error);
    }
  };

  return {
    conversations,
    currentChat,
    kbList,
    setConversations,
    setCurrentChat,
    handleCreateChatWithKb,
    handleDeleteChat,
    handleRenameChat,
    handleTogglePin,
  };
}
