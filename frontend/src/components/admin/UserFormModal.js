import React from 'react';

export default function UserFormModal({ user, form, onChange, onClose, onSave }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-box">
        <h3>{user ? `Edit '${user.username}'` : 'New User'}</h3>
        {!user && (
          <p>
            <label>
              Username
              <br />
              <input
                value={form.username}
                onChange={(event) => onChange({ ...form, username: event.target.value })}
              />
            </label>
          </p>
        )}
        <p>
          <label>
            {user ? 'New password (leave empty to keep)' : 'Password'}
            <br />
            <input
              type="password"
              value={form.password}
              onChange={(event) => onChange({ ...form, password: event.target.value })}
            />
          </label>
        </p>
        <p>
          <label>
            Role
            <br />
            <select
              value={form.user_type}
              onChange={(event) => onChange({ ...form, user_type: event.target.value })}
            >
              <option value={1}>Level 1 - Standard</option>
              <option value={2}>Level 2 - AI Operator</option>
              <option value={3}>Level 3 - System Admin</option>
            </select>
          </label>
        </p>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="tab-btn active" onClick={onSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
