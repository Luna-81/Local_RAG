import React, { useEffect, useState } from 'react';
import {
    fetchXdpStats, fetchWhitelist, addWhitelistIp, removeWhitelistIp,
    fetchDropByIp, fetchDropHistory, clearDropHistory,
} from '../../api/xdpApi';
import '../../css/XdpPanel.css';

const XdpPanel = () => {
    const [stats, setStats] = useState(null);
    const [whitelist, setWhitelist] = useState([]);
    const [ipInput, setIpInput] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    
    const [dropByIp, setDropByIp] = useState([]);        
    const [dropHistory, setDropHistory] = useState([]); 

    const loadStats = async () => {
        try {
            const res = await fetchXdpStats();
            if (res.success) setStats(res.stats);
            setError('');
        } catch (e) {
            setError(e.response?.data?.message || 'XDP not running');
        }
    };

    const loadWhitelist = async () => {
        try {
            const res = await fetchWhitelist();
            if (res.success) setWhitelist(res.whitelist);
        } catch (e) {}
    };

    
    const loadDropByIp = async () => {
        try {
            const res = await fetchDropByIp();
            if (res.success) setDropByIp(res.list || []);
        } catch (e) {}
    };

    // 新增：历史累计被拒 IP
    const loadDropHistory = async () => {
        try {
            const res = await fetchDropHistory();
            if (res.success) setDropHistory(res.list || []);
        } catch (e) {}
    };

    // 新增：清空历史
    const handleClearHistory = async () => {
        if (!window.confirm('Clear ALL drop history? This cannot be undone.')) return;
        try {
            await clearDropHistory();
            await loadDropHistory();
        } catch (e) {
            alert(e.response?.data?.message || 'Clear failed.');
        }
    };

    useEffect(() => {
        loadStats();
        loadWhitelist();
        loadDropByIp();
        loadDropHistory();
        const id1 = setInterval(loadStats, 2000);
        const id2 = setInterval(loadDropByIp, 3000);
        const id3 = setInterval(loadDropHistory, 5000);
        return () => {
            clearInterval(id1);
            clearInterval(id2);
            clearInterval(id3);
        };
    }, []);

    const handleAdd = async () => {
        if (!ipInput.trim()) return;
        setBusy(true);
        try {
            await addWhitelistIp(ipInput.trim());
            setIpInput('');
            await loadWhitelist();
        } catch (e) {
            alert(e.response?.data?.message || 'Add failed');
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (ip) => {
        if (!window.confirm(`Remove ${ip} from whitelist?`)) return;
        try {
            await removeWhitelistIp(ip);
            await loadWhitelist();
        } catch (e) {
            alert(e.response?.data?.message || 'Remove failed');
        }
    };

    return (
        <div className="xdp-wrap">
            {error && <div className="error-banner">{error}</div>}

            {/* 4 个总计卡片 */}
            <div className="xdp-cards">
                <div className="xdp-card">
                    <h4>Passed</h4>
                    <p>{stats ? stats.passedTotal.toLocaleString() : '—'}</p>
                </div>
                <div className="xdp-card">
                    <h4>Dropped</h4>
                    <p className="danger">{stats ? stats.droppedTotal.toLocaleString() : '—'}</p>
                </div>
                <div className="xdp-card">
                    <h4>Total</h4>
                    <p>{stats ? stats.totalPackets.toLocaleString() : '—'}</p>
                </div>
                <div className="xdp-card">
                    <h4>Drop Rate</h4>
                    <p className="danger">{stats ? stats.dropRate.toFixed(2) + '%' : '—'}</p>
                </div>
            </div>

            {/* 按协议分类的丢包统计 */}
            <h3 style={{ marginTop: 28 }}>📊 Dropped by Protocol</h3>
            <div className="xdp-cards">
                <div className="xdp-card">
                    <h4>TCP</h4>
                    <p className="danger">{stats ? (stats.tcpDropped || 0).toLocaleString() : '—'}</p>
                </div>
                <div className="xdp-card">
                    <h4>ICMP</h4>
                    <p className="danger">{stats ? (stats.icmpDropped || 0).toLocaleString() : '—'}</p>
                </div>
            </div>

            {/* ⭐ 新增：本次会话被拒 IP */}
            <h3 style={{ marginTop: 28 }}>🚫 Rejected by IP (Current Session)</h3>
            <div className="table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>IP Address</th>
                            <th>Dropped Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dropByIp.length === 0 ? (
                            <tr><td colSpan="2" style={{ textAlign: 'center' }}>No dropped IPs yet.</td></tr>
                        ) : dropByIp.map(item => (
                            <tr key={item.ip}>
                                <td>{item.ip}</td>
                                <td className="danger">{item.count.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ⭐ 新增：历史累计被拒 IP */}
            <h3 style={{ marginTop: 28 }}>
                📜 Rejected by IP (All Time)
                <button
                    className="btn-danger"
                    style={{ marginLeft: 12, fontSize: 12, padding: '2px 10px' }}
                    onClick={handleClearHistory}
                >
                    Clear History
                </button>
            </h3>
            <div className="table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>IP Address</th>
                            <th>Total Dropped</th>
                            <th>First Seen</th>
                            <th>Last Seen</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dropHistory.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center' }}>No history yet.</td></tr>
                        ) : dropHistory.map(item => (
                            <tr key={item.ip}>
                                <td>{item.ip}</td>
                                <td className="danger">{item.total_count.toLocaleString()}</td>
                                <td>{item.first_seen}</td>
                                <td>{item.last_seen}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 白名单管理 */}
            <h3 style={{ marginTop: 28 }}>IP Whitelist</h3>
            <div className="xdp-add-row">
                <input
                    type="text"
                    placeholder="e.g. 192.168.1.100"
                    value={ipInput}
                    onChange={e => setIpInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
                <button onClick={handleAdd} disabled={busy}>+ Add</button>
            </div>

            <div className="table-wrapper">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>IP Address</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {whitelist.length === 0 ? (
                            <tr><td colSpan="2" style={{ textAlign: 'center' }}>No whitelisted IPs.</td></tr>
                        ) : whitelist.map(ip => (
                            <tr key={ip}>
                                <td>{ip}</td>
                                <td>
                                    <button className="btn-danger" onClick={() => handleRemove(ip)}>Remove</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default XdpPanel;