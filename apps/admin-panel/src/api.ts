import { demoServer } from './demo/demoServer';
const DEMO = (import.meta.env.VITE_DEMO as string | undefined) === '1';
export const IS_DEMO = DEMO;
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';
const KEY = 'rrcabs.admin.session';

export interface Session { accessToken: string; refreshToken: string }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const loadSession = (): Session | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
export const saveSession = (s: Session | null) => { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); };

let onSessionLost: () => void = () => {};
export const setSessionLostHandler = (fn: () => void) => { onSessionLost = fn; };
let refreshing: Promise<boolean> | null = null;

async function raw(path: string, init: RequestInit & { token?: string } = {}) {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 200));
    const r = demoServer(init.method ?? 'GET', path, init.body ? JSON.parse(String(init.body)) : undefined, init.token);
    if (r.status >= 400) throw new ApiError(r.status, r.body?.error?.code ?? 'ERROR', r.body?.error?.message ?? 'Something went wrong.');
    return r.body;
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}), ...(init.headers || {}) },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your internet connection and that the API is running.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Something went wrong.');
  return body;
}

async function tryRefresh(): Promise<boolean> {
  const s = loadSession();
  if (!s) return false;
  try {
    const t = await raw('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken: s.refreshToken }) });
    saveSession({ accessToken: t.accessToken, refreshToken: t.refreshToken });
    return true;
  } catch { return false; }
}

/** Authenticated call. On an expired token it refreshes once, otherwise sends the user to the login page. */
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const s = loadSession();
  if (!s) { onSessionLost(); throw new ApiError(401, 'NO_TOKEN', 'Please sign in.'); }
  try {
    return await raw(path, { ...init, token: s.accessToken });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      refreshing ??= tryRefresh().finally(() => { refreshing = null; });
      if (await refreshing) return raw(path, { ...init, token: loadSession()!.accessToken });
      saveSession(null); onSessionLost();
    }
    throw e;
  }
}

export const apiPublic = raw;
