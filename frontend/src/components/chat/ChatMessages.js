// src/components/ChatMessages.js
import React, { useEffect, useRef } from 'react';
import Message from './Message';

function ChatMessages({ messages = [], loading = false }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="chat-messages">
      {(!messages || messages.length === 0) ? (
        <div className="empty-state">
          <p>Ask a question to start the conversation</p>
        </div>
      ) : (
        messages.map((msg, i) => (
          <Message key={msg.id || `msg-${i}`} text={msg.text} isUser={msg.isUser} />
        ))
      )}
      {loading && <Message text="..." isUser={false} loading={true} />}
      <div ref={endRef} />
    </div>
  );
}

export default ChatMessages;