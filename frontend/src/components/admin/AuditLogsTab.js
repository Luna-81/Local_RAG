import React from 'react';

export default function AuditLogsTab({ logs, filters, onFilterChange, onSearch, onClear }) {
  return (
    <>
      <div className="filter-bar">
        <input
          placeholder="Username"
          value={filters.username}
          onChange={(event) => onFilterChange({ ...filters, username: event.target.value })}
        />
        <input
          placeholder="Path contains…"
          value={filters.path}
          onChange={(event) => onFilterChange({ ...filters, path: event.target.value })}
        />
        <select
          value={filters.status}
          onChange={(event) => onFilterChange({ ...filters, status: event.target.value })}
        >
          <option value="">All status</option>
          <option value="200">200 OK</option>
          <option value="400">400 Bad Request</option>
          <option value="401">401 Unauthorized</option>
          <option value="403">403 Forbidden</option>
          <option value="404">404 Not Found</option>
          <option value="500">500 Server Error</option>
        </select>
        <button onClick={() => onSearch(1)}>Search</button>
        <button className="btn-danger audit-clear-button" onClick={onClear}>
          Clear All
        </button>
      </div>

      <div className="table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>User</th>
              <th>Method</th>
              <th>Path</th>
              <th>Status</th>
              <th>IP</th>
              <th>ms</th>
            </tr>
          </thead>
          <tbody>
            {logs.rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-cell-centered">
                  No audit records.
                </td>
              </tr>
            ) : (
              logs.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>{row.username || '-'}</td>
                  <td>{row.method}</td>
                  <td className="admin-path-cell">{row.path}</td>
                  <td
                    className={row.status >= 400 ? 'admin-status-danger' : 'admin-status-success'}
                  >
                    {row.status}
                  </td>
                  <td>{row.ip || '-'}</td>
                  <td>{row.duration_ms}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>Total {logs.total} records</span>
        <button disabled={logs.page <= 1} onClick={() => onSearch(logs.page - 1)}>
          ← Prev
        </button>
        <span>
          Page {logs.page} / {Math.max(1, Math.ceil(logs.total / logs.limit))}
        </span>
        <button
          disabled={logs.page * logs.limit >= logs.total}
          onClick={() => onSearch(logs.page + 1)}
        >
          Next →
        </button>
      </div>
    </>
  );
}
