import { useCallback, useEffect, useState } from 'react';
import {
  addWhitelistIp,
  clearDropHistory,
  fetchDropByIp,
  fetchDropHistory,
  fetchWhitelist,
  fetchXdpStats,
  removeWhitelistIp,
} from '../api/xdpApi';

export default function useXdpPanelController() {
  const [stats, setStats] = useState(null);
  const [whitelist, setWhitelist] = useState([]);
  const [ipInput, setIpInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dropByIp, setDropByIp] = useState([]);
  const [dropHistory, setDropHistory] = useState([]);

  const loadStats = useCallback(async () => {
    try {
      const response = await fetchXdpStats();
      if (response.success) setStats(response.stats);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'XDP not running');
    }
  }, []);

  const loadWhitelist = useCallback(async () => {
    try {
      const response = await fetchWhitelist();
      if (response.success) setWhitelist(response.whitelist);
    } catch (requestError) {
      console.error('Failed to load XDP whitelist:', requestError);
    }
  }, []);

  const loadDropByIp = useCallback(async () => {
    try {
      const response = await fetchDropByIp();
      if (response.success) setDropByIp(response.list || []);
    } catch (requestError) {
      console.error('Failed to load XDP drop counts:', requestError);
    }
  }, []);

  const loadDropHistory = useCallback(async () => {
    try {
      const response = await fetchDropHistory();
      if (response.success) setDropHistory(response.list || []);
    } catch (requestError) {
      console.error('Failed to load XDP drop history:', requestError);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadWhitelist();
    loadDropByIp();
    loadDropHistory();
    const statsTimer = setInterval(loadStats, 2000);
    const dropTimer = setInterval(loadDropByIp, 3000);
    const historyTimer = setInterval(loadDropHistory, 5000);
    return () => {
      clearInterval(statsTimer);
      clearInterval(dropTimer);
      clearInterval(historyTimer);
    };
  }, [loadDropByIp, loadDropHistory, loadStats, loadWhitelist]);

  const handleAdd = async () => {
    const ipAddress = ipInput.trim();
    if (!ipAddress) return;
    setBusy(true);
    try {
      await addWhitelistIp(ipAddress);
      setIpInput('');
      await loadWhitelist();
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Add failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (ipAddress) => {
    if (!window.confirm(`Remove ${ipAddress} from whitelist?`)) return;
    try {
      await removeWhitelistIp(ipAddress);
      await loadWhitelist();
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Remove failed');
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear ALL drop history? This cannot be undone.')) return;
    try {
      await clearDropHistory();
      await loadDropHistory();
    } catch (requestError) {
      alert(requestError.response?.data?.message || 'Clear failed.');
    }
  };

  return {
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
  };
}
