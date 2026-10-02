import React from 'react';
import '../../css/Chat.css';


function Message({ text, isUser, loading }) {
    if (loading) {
        return (
            <div className="message ai">
                <div className="message-content">
                    <span className="typing-dots">
                        <span>.</span><span>.</span><span>.</span>
                    </span>
                </div>
                <div className="message-time">Thinking...</div>
            </div>
        );
    }

    return (
        <div className={`message ${isUser ? 'user' : 'ai'}`}>
            <div className="message-content">{text}</div>
            <div className="message-time">{new Date().toLocaleTimeString()}</div>
        </div>
    );
}

export default Message;