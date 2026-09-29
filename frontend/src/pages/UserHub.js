// src/pages/UserHub.js
import React from 'react';

const UserHub = () => {
    return (
        <div style={{ padding: '2rem' }}>
            <h2>👤 Workspace</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '1rem' }}>
                <div style={cardStyle}>
                    <h3>🖼️ Image Analytics</h3>
                    <p>Upload and process image payloads.</p>
                </div>
                <div style={cardStyle}>
                    <h3>🏛️ Core Workflow</h3>
                    <p>Operational council and dynamic orchestration.</p>
                </div>
                <div style={cardStyle}>
                    <h3>📬 Feedback Portal</h3>
                    <p>Issue reporting and system telemetry logs.</p>
                </div>
            </div>
        </div>
    );
};

const cardStyle = { background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };

export default UserHub;