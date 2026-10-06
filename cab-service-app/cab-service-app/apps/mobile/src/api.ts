import { API_URL, DEMO } from './config';
import { demoServer } from './demo/demoServer';
import { storage } from './storage';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export interface Tokens { accessToken: string; refreshToken: string }

let tokens: Tokens | null = null;
let onExpired: () => void = () => {};
export const setExpiredHandler = (fn: () => void) => { onExpired = fn; };
export const hasTokens = () => tokens !== null;
export const currentRefreshToken = () => tokens?.refreshToken ?? null;

export async function setTokens(t: Tokens | null) {
  tokens = t;
  if (t) await storage.set('rr.refresh', t.refreshToken); else await storage.remove('rr.refresh');
}

async function call(path: string, init: RequestInit = {}, accessToken?: string) {
  if (DEMO) {
    await new Promise((r) => setTimeout(r, 250)); // feel like a real network call
    const r = demoServer(init.method ?? 'GET', path, init.body ? JSON.parse(String(init.body)) : undefined, accessToken);
    if (r.status >= 400) throw new ApiError(r.status, r.body?.error?.code ?? 'ERROR', r.body?.error?.message ?? 'Something went wrong.');
    return r.body;
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      ...init, signal: ctl.signal,
      headers: { 'content-type': 'application/json', ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}) },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your internet connection and try again.');
  } finally { clearTimeout(timer); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? 'Something went wrong. Please try again.');
  return body;
}

export const publicApi = (path: string, body?: unknown) => call(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export async function refreshWith(refreshToken: string): Promise<Tokens> {
  const r = await call('/auth/refresh', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  const t = { accessToken: r.accessToken as string, refreshToken: r.refreshToken as string };
  await setTokens(t);
  return t;
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  if (!tokens) return false;
  try { await refreshWith(tokens.refreshToken); return true; } catch (e) { return e instanceof ApiError && e.status === 0 ? false : false; }
}

/** Calls the API as the logged-in user. Refreshes an expired token once; if that fails the session is over. */
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!tokens) { onExpired(); throw new ApiError(401, 'NO_TOKEN', 'Please log in.'); }
  try {
    return await call(path, init, tokens.accessToken);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      refreshing ??= tryRefresh().finally(() => { refreshing = null; });
      if (await refreshing && tokens) return call(path, init, tokens.accessToken);
      await setTokens(null); onExpired();
    }
    throw e;
  }
}
