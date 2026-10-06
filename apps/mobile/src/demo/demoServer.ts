// DEMO MODE ONLY. A tiny in-browser stand-in for the real API, used so the apps can be previewed
// (for example on GitHub Pages) without a backend. It is only used when the app is built with
// EXPO_PUBLIC_DEMO=1 (or VITE_DEMO=1 for the admin panel). Normal builds never call it.
// This file is an identical copy in apps/mobile/src/demo and apps/admin-panel/src/demo.
// All three demo sites share one browser storage key, so approving a driver in the admin demo shows up in the driver demo.

export interface DemoResult { status: number; body: any }
type Role = 'CUSTOMER' | 'DRIVER' | 'ADMIN';
interface U {
  id: string; role: Role; phone?: string; email?: string; fullName: string | null; address?: string | null;
  kycStatus?: string; status?: string; statusReason?: string | null; isOnline?: boolean; docs?: Record<string, string>; createdAt: string; sample?: boolean;
}
interface DB { users: U[]; pricing: Record<string, number | null>; history: { id: string; createdAt: string; changedBy: string | null; isActive: boolean; values: Record<string, number | null> }[] }

const KEY = 'rr.demo.db.v1';
const PRICING: Record<string, number | null> = {
  minimumPricePerKm: 10, baseFare: 0, perMinuteFare: 0, minimumFare: 1000, maximumFare: null, platformFee: 49, driverCommissionPct: 15,
  waitingFeePerHour: 150, cancellationFee: 200, tollPer100km: 60, suvMultiplier: 1.25, sharedSeatFactor: 0.3, minSeatFare: 250,
  matchExcellentScore: 85, matchGoodScore: 70, matchMinScore: 50, matchRadiusKm: 30, matchTimeWindowMin: 120,
};
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

function seed(): DB {
  return {
    users: [
      { id: 'u-admin', role: 'ADMIN', email: 'admin@example.com', fullName: 'Demo Admin', createdAt: day(60) },
      { id: 'u-cust1', role: 'CUSTOMER', phone: '9000000001', fullName: 'Demo Customer', kycStatus: 'NOT_STARTED', status: 'ACTIVE', createdAt: day(20) },
      { id: 'u-cust2', role: 'CUSTOMER', phone: '9811100022', fullName: 'Ananya Verma', kycStatus: 'VERIFIED', status: 'ACTIVE', createdAt: day(12) },
      { id: 'u-drv1', role: 'DRIVER', phone: '9000000002', fullName: 'Demo Driver', address: 'Sector 70, Mohali', status: 'VERIFIED', isOnline: false, docs: { IDENTITY: 'APPROVED', LICENCE: 'APPROVED', REGISTRATION: 'APPROVED', INSURANCE: 'APPROVED' }, createdAt: day(30), sample: true } as U,
      { id: 'u-drv2', role: 'DRIVER', phone: '9000000003', fullName: 'Demo Pending Driver', address: 'Sector 22, Chandigarh', status: 'PENDING_VERIFICATION', isOnline: false, docs: { IDENTITY: 'UPLOADED', LICENCE: 'UPLOADED' }, createdAt: day(2) },
    ],
    pricing: { ...PRICING },
    history: [{ id: 'h0', createdAt: day(60), changedBy: null, isActive: true, values: { ...PRICING } }],
  };
}

const mem: { v: string | null } = { v: null };
function load(): DB {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : mem.v;
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  const d = seed(); save(d); return d;
}
function save(d: DB) {
  const s = JSON.stringify(d);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, s); else mem.v = s; } catch { mem.v = s; }
}
export const resetDemo = () => { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch { /* */ } mem.v = null; };

const ok = (body: any): DemoResult => ({ status: 200, body });
const err = (status: number, code: string, message: string): DemoResult => ({ status, body: { error: { code, message } } });
const tokens = (id: string) => ({ accessToken: `demo.${id}`, refreshToken: `demor.${id}`, expiresInSeconds: 900 });

export function demoServer(method: string, path: string, body: any, accessToken?: string): DemoResult {
  const db = load();
  const [route, qs] = path.split('?');
  const q = new URLSearchParams(qs ?? '');
  const authUser = (): U | null => { const id = accessToken?.startsWith('demo.') ? accessToken.slice(5) : null; return db.users.find((u) => u.id === id) ?? null; };
  const need = (...roles: Role[]): U | DemoResult => {
    const u = authUser();
    if (!u) return err(401, 'TOKEN_INVALID', 'Please log in again.');
    if (!roles.includes(u.role)) return err(403, 'WRONG_ROLE', 'You do not have access to this.');
    return u;
  };
  const isRes = (x: U | DemoResult): x is DemoResult => 'status' in x && 'body' in x;
  const m = `${method.toUpperCase()} ${route}`;

  // ---- auth ----
  if (m === 'POST /auth/send-otp') {
    if (!/^[6-9]\d{9}$/.test(body?.phone ?? '')) return err(400, 'VALIDATION', 'Enter a valid 10-digit Indian mobile number.');
    return ok({ expiresInSeconds: 300 });
  }
  if (m === 'POST /auth/verify-otp') {
    if (body?.otp !== '123456') return err(400, 'OTP_INVALID', 'That code is not correct. In this demo the code is 123456.');
    let u = db.users.find((x) => x.phone === body.phone);
    let isNew = false;
    if (u && u.role !== body.role) return err(409, 'ROLE_MISMATCH', `This number is registered as a ${u.role.toLowerCase()}.`);
    if (!u) {
      isNew = true;
      u = body.role === 'DRIVER'
        ? { id: 'u-' + Math.random().toString(36).slice(2, 9), role: 'DRIVER', phone: body.phone, fullName: null, address: null, status: 'DRAFT', isOnline: false, docs: {}, createdAt: new Date().toISOString() }
        : { id: 'u-' + Math.random().toString(36).slice(2, 9), role: 'CUSTOMER', phone: body.phone, fullName: null, kycStatus: 'NOT_STARTED', status: 'ACTIVE', createdAt: new Date().toISOString() };
      db.users.push(u); save(db);
    }
    return ok({ ...tokens(u.id), isNewUser: isNew, user: { id: u.id, role: u.role } });
  }
  if (m === 'POST /auth/refresh') {
    const id = String(body?.refreshToken ?? '').startsWith('demor.') ? body.refreshToken.slice(6) : null;
    return db.users.some((u) => u.id === id) ? ok(tokens(id!)) : err(401, 'SESSION_EXPIRED', 'Session expired. Please log in again.');
  }
  if (m === 'POST /auth/logout') return ok({ ok: true });
  if (m === 'POST /auth/admin/login') {
    if (String(body?.email).toLowerCase() === 'admin@example.com' && body?.password === 'demo1234') return ok({ ...tokens('u-admin'), user: { id: 'u-admin', role: 'ADMIN' } });
    return err(401, 'BAD_CREDENTIALS', 'Email or password is incorrect.');
  }
  if (m === 'GET /auth/me') { const u = authUser(); return u ? ok({ user: { id: u.id, role: u.role, phone: u.phone ?? null, email: u.email ?? null, status: 'ACTIVE' } }) : err(401, 'TOKEN_INVALID', 'Please log in again.'); }

  // ---- customer ----
  const custView = (u: U) => ({ id: u.id, phone: u.phone, email: u.email ?? null, fullName: u.fullName, kycStatus: u.kycStatus ?? 'NOT_STARTED', ratingAvg: '0.00', ratingCount: 0 });
  if (m === 'GET /customers/profile') { const u = need('CUSTOMER'); return isRes(u) ? u : ok({ profile: custView(u) }); }
  if (m === 'PUT /customers/profile') {
    const u = need('CUSTOMER'); if (isRes(u)) return u;
    if (String(body?.fullName ?? '').trim().length < 2) return err(400, 'VALIDATION', 'Some details are not valid.');
    u.fullName = String(body.fullName).trim(); if (body.email) u.email = String(body.email).toLowerCase(); save(db);
    return ok({ profile: custView(u) });
  }

  // ---- driver ----
  const sample = (u: U) => !!u.sample;
  const drvView = (u: U) => ({ id: u.id, phone: u.phone, fullName: u.fullName, address: u.address ?? null, status: u.status, statusReason: u.statusReason ?? null, isOnline: !!u.isOnline, ratingAvg: sample(u) ? '4.80' : '0.00', ratingCount: sample(u) ? 37 : 0 });
  if (m === 'GET /drivers/profile') { const u = need('DRIVER'); return isRes(u) ? u : ok({ profile: drvView(u) }); }
  if (m === 'PUT /drivers/profile') {
    const u = need('DRIVER'); if (isRes(u)) return u;
    if (String(body?.fullName ?? '').trim().length < 2 || String(body?.address ?? '').trim().length < 5) return err(400, 'VALIDATION', 'Some details are not valid.');
    u.fullName = String(body.fullName).trim(); u.address = String(body.address).trim();
    if (u.status === 'DRAFT') u.status = 'PENDING_VERIFICATION'; // demo shortcut: finishing the profile puts the driver in the review queue
    save(db); return ok({ profile: drvView(u) });
  }
  if (m === 'GET /drivers/verification-status') {
    const u = need('DRIVER'); if (isRes(u)) return u;
    const docs = Object.entries(u.docs ?? {}).map(([type, status]) => ({ type, status, note: null, uploadedAt: u.createdAt }));
    return ok({ status: u.status, reason: u.statusReason ?? null, profileComplete: !!(u.fullName && u.address), documents: docs });
  }
  if (m === 'POST /drivers/online') {
    const u = need('DRIVER'); if (isRes(u)) return u;
    if (body?.online && u.status !== 'VERIFIED') return err(403, 'DRIVER_NOT_VERIFIED', 'Only verified drivers can go online.');
    u.isOnline = !!body?.online; save(db); return ok({ isOnline: u.isOnline });
  }
  if (m === 'GET /drivers/summary') {
    const u = need('DRIVER'); if (isRes(u)) return u;
    const s = sample(u);
    return ok({ todayEarnings: s ? 2450 : 0, todayTrips: s ? 2 : 0, weekEarnings: s ? 14800 : 0, weekTrips: s ? 7 : 0, monthEarnings: s ? 58200 : 0, monthTrips: s ? 26 : 0,
      totalGross: s ? 72000 : 0, totalCommission: s ? 10800 : 0, totalNet: s ? 61200 : 0, ratingAvg: s ? 4.8 : 0, ratingCount: s ? 37 : 0, isOnline: !!u.isOnline });
  }

  // ---- admin ----
  if (route.startsWith('/admin/')) {
    const a = need('ADMIN'); if (isRes(a)) return a;
    const cust = db.users.filter((u) => u.role === 'CUSTOMER'), drv = db.users.filter((u) => u.role === 'DRIVER');
    if (m === 'GET /admin/stats') return ok({ stats: { totalCustomers: cust.length, activeCustomers: Math.min(cust.length, 1), totalDrivers: drv.length, verifiedDrivers: drv.filter((d) => d.status === 'VERIFIED').length, pendingDrivers: drv.filter((d) => d.status === 'PENDING_VERIFICATION').length, activeRides: 0, completedRides: 0, cancelledRides: 0, sharedRides: 0, revenue: 0, driverEarnings: 0, platformCommission: 0 } });
    if (m === 'GET /admin/customers') return ok({ customers: cust.map((u) => ({ id: u.id, phone: u.phone, status: 'ACTIVE', fullName: u.fullName, kycStatus: u.kycStatus ?? 'NOT_STARTED', createdAt: u.createdAt })) });
    if (m === 'GET /admin/drivers') {
      const st = q.get('status');
      return ok({ drivers: drv.filter((d) => !st || d.status === st).map((d) => ({ id: d.id, phone: d.phone, accountStatus: 'ACTIVE', fullName: d.fullName, address: d.address, status: d.status, statusReason: d.statusReason ?? null, isOnline: !!d.isOnline, createdAt: d.createdAt })) });
    }
    const dm = /^\/admin\/drivers\/([^/]+)\/(approve|reject|suspend)$/.exec(route);
    if (method.toUpperCase() === 'PUT' && dm) {
      const d = drv.find((x) => x.id === dm[1]); if (!d) return err(404, 'NOT_FOUND', 'Driver not found.');
      const act = dm[2], reason = String(body?.reason ?? '').trim();
      if (act !== 'approve' && reason.length < 5) return err(400, 'VALIDATION', 'Some details are not valid.');
      const from = act === 'approve' ? ['PENDING_VERIFICATION', 'SUSPENDED'] : act === 'reject' ? ['PENDING_VERIFICATION'] : ['VERIFIED', 'PENDING_VERIFICATION'];
      if (!from.includes(d.status!)) return err(409, 'INVALID_TRANSITION', 'A driver in this state cannot be moved there.');
      if (act === 'approve' && !(d.fullName && d.address)) return err(400, 'PROFILE_INCOMPLETE', 'The driver has not completed their profile yet.');
      d.status = act === 'approve' ? 'VERIFIED' : act === 'reject' ? 'REJECTED' : 'SUSPENDED';
      d.statusReason = act === 'approve' ? null : reason;
      if (d.status !== 'VERIFIED') d.isOnline = false;
      if (act === 'approve') Object.keys(d.docs ?? {}).forEach((k) => (d.docs![k] = 'APPROVED'));
      save(db); return ok({ driver: { id: d.id, status: d.status } });
    }
    if (m === 'GET /admin/pricing') return ok({ pricing: { id: 'p', createdAt: db.history[0].createdAt, ...db.pricing } });
    if (m === 'GET /admin/pricing/history') return ok({ history: db.history.map((h) => ({ id: h.id, createdAt: h.createdAt, changedBy: h.changedBy, isActive: h.isActive, ...h.values })) });
    if (m === 'PUT /admin/pricing') {
      const changes: string[] = [];
      for (const [k, v] of Object.entries(body ?? {})) {
        if (!(k in db.pricing)) return err(400, 'VALIDATION', 'Some details are not valid.');
        if (v !== null && (typeof v !== 'number' || v < 0)) return err(400, 'VALIDATION', 'Some details are not valid.');
        if (k === 'minimumPricePerKm' && !(v as number > 0)) return err(400, 'VALIDATION', 'Some details are not valid.');
        if (db.pricing[k] !== v) changes.push(k);
      }
      if (!changes.length) return err(400, 'NO_CHANGE', 'Nothing changed.');
      db.history.forEach((h) => (h.isActive = false));
      db.pricing = { ...db.pricing, ...body };
      db.history.unshift({ id: 'h' + db.history.length, createdAt: new Date().toISOString(), changedBy: 'admin@example.com', isActive: true, values: { ...db.pricing } });
      save(db); return ok({ pricing: { id: 'p', createdAt: db.history[0].createdAt, ...db.pricing }, changes });
    }
  }
  return err(404, 'NOT_FOUND', 'That address does not exist.');
}
