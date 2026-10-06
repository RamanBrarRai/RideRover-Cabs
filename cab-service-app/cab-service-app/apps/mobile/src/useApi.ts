import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Loads data from the API with loading and error states. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const load = useCallback(async () => {
    if (!path) return;
    setError(null);
    try { setData(await api<T>(path)); } catch (e: any) { setError(e.message ?? 'Something went wrong.'); } finally { setLoading(false); }
  }, [path]);
  useEffect(() => { setLoading(!!path); load(); }, [load, path]);
  return { data, error, loading, reload: load };
}
