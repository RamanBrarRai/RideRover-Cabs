import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import { AuthProvider } from '../auth';
import { NAV } from '../AdminLayout';

type Handler = (url: string, init?: RequestInit) => unknown;
function mockApi(handler: Handler) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const out: any = handler(url.replace(/^https?:\/\/[^/]+/, ''), init);
    const status = out?.__status ?? 200;
    return { ok: status < 400, status, json: async () => (out?.__status ? out.body : out) } as Response;
  }));
  return calls;
}
const signIn = () => localStorage.setItem('rrcabs.admin.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r' }));
const admin = { user: { id: '1', role: 'ADMIN', email: 'boss@example.com' } };
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
const base: Handler = (u) => {
  if (u === '/auth/me') return admin;
  if (u === '/admin/stats') return { stats: { totalCustomers: 3, activeCustomers: 1, totalDrivers: 2, verifiedDrivers: 1, pendingDrivers: 1, activeRides: 0, completedRides: 0, cancelledRides: 0, sharedRides: 0, revenue: 0, driverEarnings: 0, platformCommission: 0 } };
  if (u.startsWith('/admin/customers')) return { customers: [{ id: 'c1', fullName: 'Asha', phone: '9812345678', kycStatus: 'NOT_STARTED', status: 'ACTIVE', createdAt: '2026-01-05T00:00:00Z' }] };
  return {};
};

describe('admin panel', () => {
  it('sends a signed-out visitor to the login page', async () => {
    mockApi(base);
    renderAt('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Admin navigation' })).not.toBeInTheDocument();
  });

  it('shows the full sidebar after sign-in, with live dashboard numbers', async () => {
    signIn(); mockApi(base);
    renderAt('/admin/dashboard');
    const nav = await screen.findByRole('navigation', { name: 'Admin navigation' });
    for (const [, label] of NAV) expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument();
    expect(within(nav).getAllByRole('link')).toHaveLength(17);
    expect(await screen.findByText('Total customers')).toBeInTheDocument();
  });

  it('keeps the same sidebar on screen while moving between sections', async () => {
    signIn(); mockApi(base);
    renderAt('/admin/dashboard');
    const nav = await screen.findByRole('navigation', { name: 'Admin navigation' });
    await userEvent.click(within(nav).getByRole('link', { name: 'Customers' }));
    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('XXXXXX5678')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBe(nav);
    await userEvent.click(within(nav).getByRole('link', { name: 'Bookings' }));
    expect(await screen.findByText('Nothing to show yet')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBe(nav);
  });

  it('refuses a stored session that belongs to a non-admin account', async () => {
    signIn(); mockApi((u) => (u === '/auth/me' ? { user: { id: '9', role: 'CUSTOMER', email: null } } : {}));
    renderAt('/admin/dashboard');
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('rrcabs.admin.session')).toBeNull();
  });

  it('signs in and lands on the dashboard; a wrong password shows the message', async () => {
    mockApi((u, init) => {
      if (u === '/auth/admin/login') {
        const b = JSON.parse(String(init?.body));
        return b.password === 'right-password' ? { accessToken: 'a', refreshToken: 'r' } : { __status: 401, body: { error: { code: 'BAD_CREDENTIALS', message: 'Email or password is incorrect.' } } };
      }
      return base(u, init);
    });
    renderAt('/admin/login');
    await userEvent.type(await screen.findByLabelText('Email'), 'boss@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'right-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument();
  });

  it('sign out clears the session and returns to login', async () => {
    signIn(); mockApi(base);
    renderAt('/admin/dashboard');
    await screen.findByRole('navigation', { name: 'Admin navigation' });
    await userEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]);
    expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument();
    expect(localStorage.getItem('rrcabs.admin.session')).toBeNull();
  });

  it('pricing: changing only the per-km rate sends only that field', async () => {
    signIn();
    const pricing = { id: 'p', createdAt: '2026-01-01T00:00:00Z', minimumPricePerKm: 10, baseFare: 0, perMinuteFare: 0, minimumFare: 1000, maximumFare: null, platformFee: 49, driverCommissionPct: 15, waitingFeePerHour: 150, cancellationFee: 200, tollPer100km: 60, suvMultiplier: 1.25, sharedSeatFactor: 0.3, minSeatFare: 250, matchExcellentScore: 85, matchGoodScore: 70, matchMinScore: 50, matchRadiusKm: 30, matchTimeWindowMin: 120 };
    const calls = mockApi((u, init) => (u === '/admin/pricing' && init?.method !== 'PUT' ? { pricing } : u === '/admin/pricing/history' ? { history: [{ ...pricing, isActive: true, changedBy: null }] } : u === '/admin/pricing' ? { pricing } : base(u)));
    renderAt('/admin/pricing');
    const input = await screen.findByLabelText(/Minimum price per km/);
    await waitFor(() => expect(input).toHaveValue(10));
    await userEvent.clear(input);
    await userEvent.type(input, '11');
    await userEvent.click(screen.getByRole('button', { name: 'Save pricing' }));
    await waitFor(() => expect(calls.some((c) => c.init?.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.init?.method === 'PUT')!;
    expect(put.url).toMatch(/\/admin\/pricing$/);
    expect(JSON.parse(String(put.init!.body))).toEqual({ minimumPricePerKm: 11 });
  });

  it('verification: approve calls the approve endpoint; reject needs a reason', async () => {
    signIn();
    const calls = mockApi((u, init) => {
      if (u.startsWith('/admin/drivers?')) return { drivers: [{ id: 'd1', fullName: 'Pending One', phone: '9000000003', address: 'Sector 1', status: 'PENDING_VERIFICATION' }] };
      if (init?.method === 'PUT') return { driver: { status: 'VERIFIED' } };
      return base(u, init);
    });
    renderAt('/admin/verification');
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/admin/drivers/d1/approve') && c.init?.method === 'PUT')).toBe(true));
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dlg = await screen.findByRole('dialog');
    const confirm = within(dlg).getByRole('button', { name: 'Reject driver' });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText(/Reason/), 'Photo is unreadable');
    expect(confirm).toBeEnabled();
  });

  it('shows a clear message when the server cannot be reached', async () => {
    signIn();
    vi.stubGlobal('fetch', vi.fn(async (u: string) => { if (u.endsWith('/auth/me')) return { ok: true, status: 200, json: async () => admin } as Response; throw new TypeError('network'); }));
    renderAt('/admin/dashboard');
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server');
  });
});
