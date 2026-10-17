import React from 'react';
import useDashboardData from '../hooks/useDashboardData';
import '../css/Dashboard.css';

function MetricCard({ label, value, variant = '' }) {
  return (
    <div className={`dashboard-metric-card ${variant}`}>
      <span className="dashboard-metric-label">{label}</span>
      <strong className="dashboard-metric-value">{value}</strong>
    </div>
  );
}

function Dashboard() {
  const { stats, whitelist, loading, error } = useDashboardData();
  const totalPackets = stats.totalPackets || 0;
  const passRate = totalPackets ? (stats.passedTotal / totalPackets) * 100 : 0;
  const dropRate = totalPackets ? (stats.droppedTotal / totalPackets) * 100 : 0;

  return (
    <div className="dashboard-container">
      <h2>📊 System Dashboard</h2>
      <p className="dashboard-subtitle">Real-time system and network security overview</p>

      <section className="dashboard-firewall-card">
        <header className="dashboard-firewall-header">
          <div>
            <h3>🛡️ XDP / eBPF Kernel Firewall</h3>
            <p>Kernel-level packet inspection · Real-time traffic stats</p>
          </div>
          <span className="dashboard-live-badge">
            <span className="dashboard-live-indicator" />
            LIVE
          </span>
        </header>

        {error && <div className="dashboard-error">{error}</div>}

        {loading ? (
          <p className="dashboard-loading">Connecting to eBPF kernel maps...</p>
        ) : (
          <>
            <div className="dashboard-metrics-grid">
              <MetricCard label="Total Processed" value={stats.totalPackets.toLocaleString()} />
              <MetricCard
                label={`Passed (${passRate.toFixed(1)}%)`}
                value={stats.passedTotal.toLocaleString()}
                variant="passed"
              />
              <MetricCard
                label={`Kernel Dropped (${dropRate.toFixed(1)}%)`}
                value={stats.droppedTotal.toLocaleString()}
                variant="dropped"
              />
            </div>

            <svg
              className="dashboard-packet-bar"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              role="progressbar"
              aria-label="Passed and dropped packet distribution"
              aria-valuenow={Math.round(passRate)}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <rect className="dashboard-passed-segment" x="0" y="0" width={passRate} height="10" />
              <rect
                className="dashboard-dropped-segment"
                x={passRate}
                y="0"
                width={dropRate}
                height="10"
              />
            </svg>

            <h4 className="dashboard-whitelist-title">📋 Active Whitelist ({whitelist.length})</h4>
            {whitelist.length === 0 ? (
              <span className="dashboard-empty-whitelist">No IPs in kernel whitelist.</span>
            ) : (
              <div className="dashboard-whitelist">
                {whitelist.map((ip) => (
                  <span className="dashboard-whitelist-ip" key={ip}>
                    {ip}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
