import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getConversationsApi } from '../api/chatApi';
import { listKbApi } from '../api/kbApi';
import '../css/UserHub.css';

const ACTIONS = [
    { path: '/chat', title: 'Chat Console', detail: 'Ask questions about your knowledge bases.', permission: 'view:chat' },
    { path: '/documents', title: 'Documents', detail: 'Upload and manage source PDFs.', permission: 'manage:documents' },
    { path: '/lancedb-manager', title: 'LanceDB Manager', detail: 'Inspect indexed documents and knowledge maps.', permission: 'manage:lancedb' },
    { path: '/dashboard', title: 'Dashboard', detail: 'View system and network statistics.', permission: 'view:dashboard' },
    { path: '/admin-panel', title: 'Admin Panel', detail: 'Manage users and audit logs.', permission: 'manage:system' },
];

const UserHub = ({ user }) => {
    const permissions = user?.permissions || [];
    const [conversations, setConversations] = useState([]);
    const [knowledgeBases, setKnowledgeBases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        Promise.allSettled([getConversationsApi(), listKbApi()]).then(([chatResult, kbResult]) => {
            if (!active) return;
            if (chatResult.status === 'fulfilled' && chatResult.value.success) {
                setConversations(chatResult.value.conversations || []);
            }
            if (kbResult.status === 'fulfilled' && kbResult.value.success) {
                setKnowledgeBases(kbResult.value.knowledgeBases || []);
            }
            if (chatResult.status === 'rejected' || kbResult.status === 'rejected') {
                setError('Some workspace details could not be loaded.');
            }
            setLoading(false);
        });
        return () => { active = false; };
    }, []);

    return (
        <div className="user-hub">
            <header className="user-hub-header">
                <p className="user-hub-eyebrow">WORKSPACE</p>
                <h1>Welcome, {user?.username || 'user'}</h1>
                <p>Pick up a conversation or open one of your workspace tools.</p>
            </header>

            {error && <p className="user-hub-error" role="status">{error}</p>}

            <div className="user-hub-summary" aria-label="Workspace summary">
                <div><strong>{loading ? '…' : conversations.length}</strong><span>Conversations</span></div>
                <div><strong>{loading ? '…' : knowledgeBases.length}</strong><span>Knowledge bases</span></div>
            </div>

            <section className="user-hub-section">
                <h2>Quick access</h2>
                <div className="user-hub-actions">
                    {ACTIONS.filter(action => permissions.includes(action.permission)).map(action => (
                        <Link className="user-hub-action" key={action.path} to={action.path}>
                            <strong>{action.title}</strong>
                            <span>{action.detail}</span>
                            <span className="user-hub-arrow" aria-hidden="true">→</span>
                        </Link>
                    ))}
                </div>
            </section>

        </div>
    );
};

export default UserHub;
