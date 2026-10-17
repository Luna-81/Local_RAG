import { useCallback, useEffect, useState } from 'react';
import { fetchWhitelist, fetchXdpStats } from '../api/xdpApi';

const EMPTY_STATS = { passedTotal: 0, droppedTotal: 0, totalPackets: 0 };

export default function useDashboardData() {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [whitelist, setWhitelist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = useCallback(async () => {
    try {
      const [statsResponse, whitelistResponse] = await Promise.all([
        fetchXdpStats(),
        fetchWhitelist(),
      ]);
      if (statsResponse.success) setStats(statsResponse.stats);
      if (whitelistResponse.success) setWhitelist(whitelistResponse.whitelist || []);
      setError('');
    } catch (requestError) {
      console.error('Failed to fetch XDP data:', requestError);
      setError(
        requestError.response?.data?.message ||
          'XDP metrics unavailable. Administrator permissions required.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    const timer = setInterval(() => {
      fetchXdpStats()
        .then((response) => {
          if (response.success) setStats(response.stats);
        })
        .catch((requestError) => console.error('XDP stats poll error:', requestError));
    }, 3000);
    return () => clearInterval(timer);
  }, [loadDashboardData]);

  return { stats, whitelist, loading, error };
}
