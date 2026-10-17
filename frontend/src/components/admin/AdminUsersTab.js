import React from 'react';

export default function AdminUsersTab({ users, onCreate, onEdit, onDelete, onChangeType }) {
  return (
    <>
      <div className="admin-action-toolbar">
        <button className="tab-btn" onClick={onCreate}>
          + New User
        </button>
      </div>
      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>User Level</th>
              <th>Created At</th>
              <th>Permission</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>Level {user.user_type}</td>
                <td>{new Date(user.created_at).toLocaleString()}</td>
                <td>
                  <select
                    value={user.user_type}
                    onChange={(event) => onChangeType(user.id, event.target.value)}
                  >
                    <option value={1}>Level 1</option>
                    <option value={2}>Level 2</option>
                    <option value={3}>Level 3</option>
                  </select>
                </td>
                <td>
                  <button onClick={() => onEdit(user)}>Edit</button>{' '}
                  <button className="btn-danger" onClick={() => onDelete(user)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
