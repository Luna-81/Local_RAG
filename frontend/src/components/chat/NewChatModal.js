// src/components/NewChatModal.js
import React, { useState } from 'react';

function NewChatModal({ kbList = [], onClose, onCreate }) {
  const [selected, setSelected] = useState(kbList[0]?.id || null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await onCreate(selected);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kb-modal-mask" onClick={onClose}>
      <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>New Conversation</h3>

        {kbList.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 14 }}>
            No knowledge bases available. Create one in the Documents page first.
          </p>
        ) : (
          <>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
              Choose a knowledge base to ask questions from.
            </p>

            <div className="kb-field">
              <label>Knowledge base</label>
              <select
                value={selected || ''}
                onChange={(e) => setSelected(Number(e.target.value))}
                disabled={busy}
              >
                {kbList.map((kb) => (
                  <option key={kb.id} value={kb.id}>
                    {kb.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="kb-modal-actions">
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button
            className="primary"
            onClick={handleCreate}
            disabled={busy || !selected || kbList.length === 0}
          >
            {busy ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewChatModal;