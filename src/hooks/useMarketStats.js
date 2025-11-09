import { useState, useEffect, useRef, useCallback } from 'react';
import { ENABLE_LIVE_API, LIVE_API_KEY } from '../config';

const DEFAULT_POLL_MS = 30000;

const fetchJSON = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(options.etag ? { 'If-None-Match': options.etag } : {}),
      ...(LIVE_API_KEY ? { 'x-api-key': LIVE_API_KEY } : {})
    },
    cache: 'no-cache'
  });
  const { status } = res;
  if (status === 304) {
    return { status, etag: options.etag ?? null, data: null };
  }
  if (!res.ok) {
    throw new Error(`HTTP ${status}`);
  }
  const etag = res.headers.get('ETag');
  if (status === 204 || status === 205) {
    return { status, etag, data: null };
  }
  const raw = await res.text();
  if (!raw) {
    return { status, etag, data: null };
  }
  try {
    const json = JSON.parse(raw);
    return { status, etag, data: json };
  } catch (err) {
    throw new Error('Invalid JSON response');
  }
};

export default function useMarketStats({ interval = '5m', indexCode = null, pollMs = DEFAULT_POLL_MS } = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [indices, setIndices] = useState(null);
  const etagRef = useRef(null);
  const indicesEtagRef = useRef(null);

  const fetchStats = useCallback(async () => {
    if (!ENABLE_LIVE_API) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (interval) qs.set('interval', interval);
    if (indexCode) qs.set('index', indexCode);
    try {
      const result = await fetchJSON(`/api/market-stats?${qs.toString()}`, { etag: etagRef.current });
      if (result.status === 204 || result.data == null) {
        setStats(null);
        etagRef.current = result.etag ?? null;
      } else if (result.status !== 304) {
        setStats(result.data);
        etagRef.current = result.etag ?? null;
      }
      setError(null);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [interval, indexCode]);

  const fetchIndices = useCallback(async () => {
    if (!ENABLE_LIVE_API) return;
    try {
      const result = await fetchJSON('/api/market-stats/indices', { etag: indicesEtagRef.current });
      if (result.status === 204 || result.data == null) {
        setIndices(null);
        indicesEtagRef.current = result.etag ?? null;
      } else if (result.status !== 304) {
        setIndices(result.data);
        indicesEtagRef.current = result.etag ?? null;
      }
    } catch (err) {
      // non-fatal; keep prior indices cached
    }
  }, []);

  useEffect(() => {
    etagRef.current = null;
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchIndices();
  }, [fetchIndices]);

  useEffect(() => {
    if (!ENABLE_LIVE_API) return undefined;
    if (!pollMs || pollMs <= 0) return undefined;
    const handle = setInterval(() => {
      fetchStats();
      fetchIndices();
    }, pollMs);
    return () => clearInterval(handle);
  }, [fetchStats, fetchIndices, pollMs]);

  return {
    stats,
    indices,
    loading,
    error,
    refresh: () => {
      fetchStats();
      fetchIndices();
    }
  };
}


