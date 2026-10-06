import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { APP_ROLE } from '../config';
import { useAuth } from '../auth/AuthContext';

export interface Profile {
  id: string; phone: string; fullName: string | null; ratingAvg?: string; ratingCount?: number;
  email?: string | null; kycStatus?: string;                                   // customer
  address?: string | null; status?: string; statusReason?: string | null; isOnline?: boolean; // driver
}
interface Ctx { state: 'loading' | 'ready' | 'error'; profile: Profile | null; error: string | null; refresh(): Promise<void>; setProfile(p: Profile): void }
const C = createContext<Ctx>(null as unknown as Ctx);
export const useProfile = () => useContext(C);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [state, setState] = useState<Ctx['state']>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const path = APP_ROLE === 'DRIVER' ? '/drivers/profile' : '/customers/profile';
  const active = status === 'in' && user?.role === APP_ROLE;

  const refresh = useCallback(async () => {
    try { const r = await api<{ profile: Profile }>(path); setProfile(r.profile); setState('ready'); setError(null); }
    catch (e: any) { setError(e.message); setState((s) => (s === 'ready' ? 'ready' : 'error')); }
  }, [path]);

  useEffect(() => { if (active) { setState('loading'); refresh(); } else { setProfile(null); setState('loading'); } }, [active, refresh]);

  const value = useMemo(() => ({ state, profile, error, refresh, setProfile }), [state, profile, error, refresh]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
