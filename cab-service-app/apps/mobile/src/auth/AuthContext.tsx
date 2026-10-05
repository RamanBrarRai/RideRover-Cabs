import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, currentRefreshToken, publicApi, refreshWith, setExpiredHandler, setTokens, Tokens } from '../api';
import { storage } from '../storage';
import type { Role } from '../navigation/guards';

export interface User { id: string; role: Role }
interface State { status: 'loading' | 'out' | 'in' | 'error'; user: User | null; message: string | null; seenOnboarding: boolean }
interface Ctx extends State {
  signIn(tokens: Tokens, user: User): Promise<void>;
  signOut(): Promise<void>;
  retry(): void;
  finishOnboarding(): Promise<void>;
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>({ status: 'loading', user: null, message: null, seenOnboarding: true });
  const [attempt, setAttempt] = useState(0);

  const expire = useCallback(() => setS((p) => ({ ...p, status: 'out', user: null, message: 'Your session has ended. Please log in again.' })), []);
  useEffect(() => { setExpiredHandler(expire); }, [expire]);

  // On every app start: if a session was saved, restore it and go straight to the right home screen.
  useEffect(() => {
    let alive = true;
    (async () => {
      const seen = (await storage.get('rr.onboarded')) === '1';
      const rt = await storage.get('rr.refresh');
      if (!rt) return alive && setS({ status: 'out', user: null, message: null, seenOnboarding: seen });
      try {
        await refreshWith(rt);
        const { user } = await api('/auth/me');
        if (alive) setS({ status: 'in', user: { id: user.id, role: user.role }, message: null, seenOnboarding: seen });
      } catch (e) {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 0) setS({ status: 'error', user: null, message: e.message, seenOnboarding: seen });
        else { await setTokens(null); setS({ status: 'out', user: null, message: null, seenOnboarding: seen }); }
      }
    })();
    return () => { alive = false; };
  }, [attempt]);

  const signIn = useCallback(async (t: Tokens, user: User) => {
    await setTokens(t);
    setS((p) => ({ ...p, status: 'in', user, message: null }));
  }, []);

  const signOut = useCallback(async () => {
    const rt = currentRefreshToken();
    if (rt) await publicApi('/auth/logout', { refreshToken: rt }).catch(() => {});
    await setTokens(null);
    setS((p) => ({ ...p, status: 'out', user: null, message: null }));
  }, []);

  const finishOnboarding = useCallback(async () => { await storage.set('rr.onboarded', '1'); setS((p) => ({ ...p, seenOnboarding: true })); }, []);
  const retry = useCallback(() => { setS((p) => ({ ...p, status: 'loading' })); setAttempt((a) => a + 1); }, []);

  const value = useMemo(() => ({ ...s, signIn, signOut, retry, finishOnboarding }), [s, signIn, signOut, retry, finishOnboarding]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
