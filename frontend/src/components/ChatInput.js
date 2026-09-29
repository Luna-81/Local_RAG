import React, { useState } from 'react';
import '../css/Chat.css';

function ChatInput({ onAsk, disabled }) {
    const [question, setQuestion] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!question.trim() || disabled) return;
        onAsk(question);
        setQuestion('');
    };

    return (
        <form className="chat-input-area" onSubmit={handleSubmit}>
            <input
                type="text"
                placeholder="Ask a question..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={disabled}
            />
            <button type="submit" disabled={disabled || !question.trim()}>
                Send
            </button>
        </form>
    );
}

export default ChatInput;