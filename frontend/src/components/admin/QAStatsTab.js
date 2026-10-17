import React from 'react';

export default function QAStatsTab({ stats }) {
  return (
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Question</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {stats.length === 0 ? (
            <tr>
              <td colSpan="4" className="admin-cell-centered">
                No QA history.
              </td>
            </tr>
          ) : (
            stats.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.username}</td>
                <td>{item.question}</td>
                <td>{new Date(item.created_at).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
