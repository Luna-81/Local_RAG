// src/components/CreateKbModal.js
import React, { useState } from 'react';
import { createKbApi } from '../../api/kbApi';

function CreateKbModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await createKbApi(trimmed, description.trim());
      onCreated(res.knowledgeBase);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="kb-modal-mask" onClick={onClose}>
      <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
        <h3>New knowledge base</h3>

        <div className="kb-field">
          <label>Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Research papers"
            maxLength={50}
            autoFocus
          />
        </div>

        <div className="kb-field">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
            rows={3}
          />
        </div>

        {error && <div className="kb-error">{error}</div>}

        <div className="kb-modal-actions">
          <button onClick={onClose} disabled={submitting}>Cancel</button>
          <button
            className="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateKbModal;