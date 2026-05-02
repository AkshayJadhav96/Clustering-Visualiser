import { useState, useCallback } from 'react';
import { clusterApi } from '../services/api';

/**
 * Upload + run clustering with shared loading / error state.
 */
export function useClusterApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const upload = useCallback(async (file) => {
    setError(null);
    setLoading(true);
    try {
      const res = await clusterApi.upload(file);
      if (!res.ok) {
        setError(res.error);
        return null;
      }
      return res.data;
    } finally {
      setLoading(false);
    }
  }, []);

  const run = useCallback(async (payload) => {
    setError(null);
    setLoading(true);
    try {
      const res = await clusterApi.run(payload);
      if (!res.ok) {
        setError(res.error);
        return null;
      }
      return res.data;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { loading, error, upload, run, clearError };
}
