import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchXdpStats, fetchWhitelist } from '../api/xdpApi';

const Dashboard = () => {
    const navigate = useNavigate();

    const [stats, setStats] = useState({ passedTotal: 0, droppedTotal: 0, totalPackets: 0 });
    const [whitelist, setWhitelist] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    // 只读数据加载
    const loadData = useCallback(async () => {
        try {
            const [statsRes, listRes] = await Promise.all([
                fetchXdpStats(),
                fetchWhitelist(),
            ]);
            if (statsRes.success) setStats(statsRes.stats);
            if (listRes.success) setWhitelist(listRes.whitelist || []);
            setErrorMsg('');
        } catch (err) {
            console.error('Failed to fetch XDP data:', err);
            setErrorMsg(
                err.response?.data?.message ||
                'XDP metrics unavailable. Administrator permissions required.'
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
        const timer = setInterval(() => {
            fetchXdpStats()
                .then(res => { if (res.success) setStats(res.stats); })
                .catch(err => console.error('XDP stats poll error:', err));
        }, 3000);
        return () => clearInterval(timer);
    }, [loadData]);

    const passRate = stats.totalPackets > 0
        ? ((stats.passedTotal / stats.totalPackets) * 100).toFixed(1)
        : '0.0';
    const dropRate = stats.totalPackets > 0
        ? ((stats.droppedTotal / stats.totalPackets) * 100).toFixed(1)
        : '0.0';

    return (
        <div style={{ padding: '2rem' }}>
            <h2>📊 System Dashboard</h2>
            <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Real-time system and network security overview
            </p>

            {/* XDP 只读大盘 */}
            <div style={{ marginTop: '2rem', ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ margin: 0 }}>🛡️ XDP / eBPF Kernel Firewall</h3>
                        <p style={{ color: '#666', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                            Kernel-level packet inspection · Real-time traffic stats
                        </p>
                    </div>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.75rem',
                        color: '#137333',
                        background: '#e6f4ea',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '10px',
                        fontWeight: 600,
                    }}>
                        <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#34a853',
                            animation: 'pulse 1.5s ease-in-out infinite',
                        }} />
                        LIVE
                    </span>
                </div>

                {errorMsg && (
                    <div style={{ background: '#ffe6e6', color: '#d93025', padding: '10px', borderRadius: '4px', marginTop: '1rem' }}>
                        {errorMsg}
                    </div>
                )}

                {loading ? (
                    <p style={{ color: '#666', marginTop: '1rem' }}>Connecting to eBPF kernel maps...</p>
                ) : (
                    <>
                        {/* 3 个数字卡片 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', margin: '1.5rem 0' }}>
                            <div style={{ background: '#f8f9fa', borderLeft: '4px solid #1a73e8', padding: '1rem', borderRadius: '4px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#5f6368', marginBottom: '0.4rem' }}>Total Processed</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold' }}>{stats.totalPackets.toLocaleString()}</div>
                            </div>
                            <div style={{ background: '#f8f9fa', borderLeft: '4px solid #34a853', padding: '1rem', borderRadius: '4px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#5f6368', marginBottom: '0.4rem' }}>Passed ({passRate}%)</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#137333' }}>{stats.passedTotal.toLocaleString()}</div>
                            </div>
                            <div style={{ background: '#f8f9fa', borderLeft: '4px solid #ea4335', padding: '1rem', borderRadius: '4px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#5f6368', marginBottom: '0.4rem' }}>Kernel Dropped ({dropRate}%)</div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#c5221f' }}>{stats.droppedTotal.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* 进度条 */}
                        <div style={{ height: '10px', background: '#e0e0e0', borderRadius: '5px', overflow: 'hidden', display: 'flex', margin: '0 0 1.5rem 0' }}>
                            <div style={{ width: `${passRate}%`, background: '#34a853', transition: 'width 0.5s' }} />
                            <div style={{ width: `${dropRate}%`, background: '#ea4335', transition: 'width 0.5s' }} />
                        </div>

                        {/* 白名单只读 chips */}
                        <h4 style={{ marginBottom: '0.75rem' }}>
                            📋 Active Whitelist ({whitelist.length})
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {whitelist.length === 0 ? (
                                <span style={{ color: '#70757a', fontSize: '0.9rem' }}>
                                    No IPs in kernel whitelist.
                                </span>
                            ) : whitelist.map(ip => (
                                <span
                                    key={ip}
                                    style={{
                                        background: '#e6f4ea',
                                        color: '#137333',
                                        padding: '0.35rem 0.8rem',
                                        borderRadius: '14px',
                                        fontSize: '0.85rem',
                                        fontFamily: 'monospace',
                                        fontWeight: 500,
                                    }}
                                >
                                    {ip}
                                </span>
                            ))}
                        </div>

                        
                    </>
                )}
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

const cardStyle = {
    background: '#fff',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
};

export default Dashboard;