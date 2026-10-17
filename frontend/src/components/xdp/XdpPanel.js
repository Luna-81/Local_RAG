import React from 'react';
import useXdpPanelController from '../../hooks/useXdpPanelController';
import '../../css/XdpPanel.css';

function MetricCard({ label, value, danger = false }) {
  return (
    <div className="xdp-card">
      <h4>{label}</h4>
      <p className={danger ? 'danger' : undefined}>{value}</p>
    </div>
  );
}

function IpTable({ headers, emptyMessage, children }) {
  return (
    <div className="table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {React.Children.count(children) > 0 ? (
            children
          ) : (
            <tr>
              <td colSpan={headers.length} className="utility-cell-centered">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function XdpPanel() {
  const {
    stats,
    whitelist,
    ipInput,
    setIpInput,
    error,
    busy,
    dropByIp,
    dropHistory,
    handleAdd,
    handleRemove,
    handleClearHistory,
  } = useXdpPanelController();

  return (
    <div className="xdp-wrap">
      {error && <div className="error-banner">{error}</div>}
      <div className="xdp-cards">
        <MetricCard label="Passed" value={stats ? stats.passedTotal.toLocaleString() : '—'} />
        <MetricCard
          label="Dropped"
          value={stats ? stats.droppedTotal.toLocaleString() : '—'}
          danger
        />
        <MetricCard label="Total" value={stats ? stats.totalPackets.toLocaleString() : '—'} />
        <MetricCard
          label="Drop Rate"
          value={stats ? `${stats.dropRate.toFixed(2)}%` : '—'}
          danger
        />
      </div>

      <h3 className="xdp-section-heading">📊 Dropped by Protocol</h3>
      <div className="xdp-cards">
        <MetricCard
          label="TCP"
          value={stats ? (stats.tcpDropped || 0).toLocaleString() : '—'}
          danger
        />
        <MetricCard
          label="ICMP"
          value={stats ? (stats.icmpDropped || 0).toLocaleString() : '—'}
          danger
        />
      </div>

      <h3 className="xdp-section-heading">IP Whitelist</h3>
      <div className="xdp-add-row">
        <input
          type="text"
          placeholder="e.g. 192.168.1.100"
          value={ipInput}
          onChange={(event) => setIpInput(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && handleAdd()}
        />
        <button onClick={handleAdd} disabled={busy}>
          + Add
        </button>
      </div>
      <IpTable headers={['IP Address', 'Action']} emptyMessage="No whitelisted IPs.">
        {whitelist.map((ip) => (
          <tr key={ip}>
            <td>{ip}</td>
            <td>
              <button className="btn-danger" onClick={() => handleRemove(ip)}>
                Remove
              </button>
            </td>
          </tr>
        ))}
      </IpTable>

      <h3 className="xdp-section-heading">🚫 Rejected by IP (Current Session)</h3>
      <IpTable headers={['IP Address', 'Dropped Count']} emptyMessage="No dropped IPs.">
        {dropByIp.map((item) => (
          <tr key={item.ip}>
            <td>{item.ip}</td>
            <td className="danger">{item.count.toLocaleString()}</td>
          </tr>
        ))}
      </IpTable>

      <h3 className="xdp-section-heading">
        📜 Rejected by IP (All Time)
        <button className="xdp-clear-history-btn" onClick={handleClearHistory}>
          Clear History
        </button>
      </h3>
      <IpTable
        headers={['IP Address', 'Total Dropped', 'First Seen', 'Last Seen']}
        emptyMessage="No history yet."
      >
        {dropHistory.map((item) => (
          <tr key={item.ip}>
            <td>{item.ip}</td>
            <td className="danger">{item.total_count.toLocaleString()}</td>
            <td>{item.first_seen}</td>
            <td>{item.last_seen}</td>
          </tr>
        ))}
      </IpTable>
    </div>
  );
}

export default XdpPanel;
