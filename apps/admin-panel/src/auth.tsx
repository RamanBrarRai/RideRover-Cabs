import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, apiPublic, loadSession, saveSession, setSessionLostHandler } from './api';

export interface Admin { id: string; email: string }
interface Ctx { status: 'loading' | 'out' | 'in'; admin: Admin | null; login(email: string, password: string): Promise<void>; logout(): Promise<void> }
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Ctx['status']>('loading');
  const [admin, setAdmin] = useState<Admin | null>(null);

  const clear = useCallback(() => { saveSession(null); setAdmin(null); setStatus('out'); }, []);
  useEffect(() => { setSessionLostHandler(clear); }, [clear]);

  // On open or reload: if a session is stored, confirm it and confirm this is an ADMIN account.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!loadSession()) return alive && setStatus('out');
      try {
        const { user } = await api('/auth/me');
        if (!alive) return;
        if (user.role !== 'ADMIN') return clear();
        setAdmin({ id: user.id, email: user.email });
        setStatus('in');
      } catch { if (alive) clear(); }
    })();
    return () => { alive = false; };
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const r = await apiPublic('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    saveSession({ accessToken: r.accessToken, refreshToken: r.refreshToken });
    const { user } = await api('/auth/me');
    setAdmin({ id: user.id, email: user.email });
    setStatus('in');
  }, []);

  const logout = useCallback(async () => {
    const s = loadSession();
    if (s) await apiPublic('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: s.refreshToken }) }).catch(() => {});
    clear();
  }, [clear]);

  const value = useMemo(() => ({ status, admin, login, logout }), [status, admin, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
