import React from 'react';

export default function UserFormModal({ user, form, onChange, onClose, onSave }) {
  return (
    <div className="modal-backdrop">
      <form
        className="modal-box"
        autoComplete="off"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <h3>{user ? `Edit '${user.username}'` : 'New User'}</h3>
        {!user && (
          <p>
            <label>
              Username
              <br />
              <input
                autoComplete="off"
                name="new-user-username"
                type="text"
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
              autoComplete="new-password"
              name={user ? 'edit-user-password' : 'new-user-password'}
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
              className="user-form-select"
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
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="tab-btn active" type="submit">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
