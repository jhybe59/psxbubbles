import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchTopCoins } from '../api/demoCoins';

export function useCoins(initialN = 30, refreshInterval = 60000) {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [topN, setTopN] = useState(initialN);
  const timerRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTopCoins(topN);
      setCoins(data);
    } catch (err) {
      setError(err.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [topN]);

  useEffect(() => {
    load();
    if (refreshInterval > 0) {
      timerRef.current = setInterval(load, refreshInterval);
      return () => clearInterval(timerRef.current);
    }
  }, [load, refreshInterval]);

  return { coins, loading, error, topN, setTopN, reload: load };
}
