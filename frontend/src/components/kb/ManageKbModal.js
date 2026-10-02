// src/components/ManageKbModal.js
import React, { useState } from 'react';
import { updateKbApi, deleteKbApi } from '../../api/kbApi';

function ManageKbModal({ list, onClose, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [busyId, setBusyId] = useState(null);

  const startEdit = (kb) => {
    setEditingId(kb.id);
    setEditName(kb.name);
    setEditDesc(kb.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditDesc('');
  };

  const saveEdit = async (id) => {
    if (!editName.trim()) {
      alert('Name is required');
      return;
    }
    setBusyId(id);
    try {
      await updateKbApi(id, {
        name: editName.trim(),
        description: editDesc.trim()
      });
      await onChanged();
      cancelEdit();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (kb) => {
    if (kb.fileCount > 0) {
      alert(`This knowledge base still contains ${kb.fileCount} file(s). Delete them first.`);
      return;
    }
    if (!window.confirm(`Delete knowledge base "${kb.name}"?\nThis cannot be undone.`)) return;

    setBusyId(kb.id);
    try {
      await deleteKbApi(kb.id);
      await onChanged();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="kb-modal-mask" onClick={onClose}>
      <div
        className="kb-modal kb-modal-wide"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Manage knowledge bases</h3>

        <table className="kb-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Files</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>
                  No knowledge bases yet
                </td>
              </tr>
            )}
            {list.map((kb) => (
              <tr key={kb.id}>
                <td>
                  {editingId === kb.id ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={50}
                      autoFocus
                    />
                  ) : (
                    kb.name
                  )}
                </td>
                <td>
                  {editingId === kb.id ? (
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                    />
                  ) : (
                    kb.description || <span className="muted">-</span>
                  )}
                </td>
                <td>{kb.fileCount}</td>
                <td>
                  {editingId === kb.id ? (
                    <>
                      <button
                        className="kb-btn small primary"
                        onClick={() => saveEdit(kb.id)}
                        disabled={busyId === kb.id}
                      >
                        Save
                      </button>
                      <button
                        className="kb-btn small"
                        onClick={cancelEdit}
                        disabled={busyId === kb.id}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="kb-btn small"
                        onClick={() => startEdit(kb)}
                        disabled={busyId === kb.id}
                      >
                        Rename
                      </button>
                      <button
                        className="kb-btn small danger"
                        onClick={() => handleDelete(kb)}
                        disabled={busyId === kb.id || kb.fileCount > 0}
                        title={
                          kb.fileCount > 0
                            ? 'Cannot delete: KB still has files'
                            : 'Delete this KB'
                        }
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="kb-modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default ManageKbModal;