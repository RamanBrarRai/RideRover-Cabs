import { beforeEach, describe, expect, it } from 'vitest';
import { demoServer, resetDemo } from './demoServer';

beforeEach(() => resetDemo());
const login = (phone: string, role: 'CUSTOMER' | 'DRIVER') => demoServer('POST', '/auth/verify-otp', { phone, role, otp: '123456' }).body;

describe('demo server behaves like the real API', () => {
  it('rejects a wrong code and accepts 123456', () => {
    expect(demoServer('POST', '/auth/verify-otp', { phone: '9000000001', role: 'CUSTOMER', otp: '000000' }).status).toBe(400);
    expect(login('9000000001', 'CUSTOMER').user.role).toBe('CUSTOMER');
  });
  it('keeps roles apart', () => {
    expect(demoServer('POST', '/auth/verify-otp', { phone: '9000000001', role: 'DRIVER', otp: '123456' }).status).toBe(409);
    const c = login('9000000001', 'CUSTOMER');
    expect(demoServer('GET', '/drivers/profile', undefined, c.accessToken).status).toBe(403);
    expect(demoServer('GET', '/admin/stats', undefined, c.accessToken).status).toBe(403);
  });
  it('lets only verified drivers go online', () => {
    const pending = login('9000000003', 'DRIVER');
    expect(demoServer('POST', '/drivers/online', { online: true }, pending.accessToken).status).toBe(403);
    const ok = login('9000000002', 'DRIVER');
    expect(demoServer('POST', '/drivers/online', { online: true }, ok.accessToken).body.isOnline).toBe(true);
  });
  it('admin approval shows up for the driver (shared data across the three demo sites)', () => {
    const drv = login('9000000003', 'DRIVER');
    expect(demoServer('GET', '/drivers/profile', undefined, drv.accessToken).body.profile.status).toBe('PENDING_VERIFICATION');
    const adm = demoServer('POST', '/auth/admin/login', { email: 'admin@example.com', password: 'demo1234' }).body;
    expect(demoServer('PUT', `/admin/drivers/${drv.user.id}/approve`, {}, adm.accessToken).status).toBe(200);
    expect(demoServer('GET', '/drivers/profile', undefined, drv.accessToken).body.profile.status).toBe('VERIFIED');
  });
  it('a brand-new driver goes through profile, then review, then approval', () => {
    const d = login('9123456780', 'DRIVER');
    expect(demoServer('GET', '/drivers/profile', undefined, d.accessToken).body.profile.status).toBe('DRAFT');
    demoServer('PUT', '/drivers/profile', { fullName: 'New Driver', address: 'Phase 3, Mohali' }, d.accessToken);
    expect(demoServer('GET', '/drivers/profile', undefined, d.accessToken).body.profile.status).toBe('PENDING_VERIFICATION');
  });
  it('rejecting needs a reason and the driver sees it', () => {
    const drv = login('9000000003', 'DRIVER');
    const adm = demoServer('POST', '/auth/admin/login', { email: 'admin@example.com', password: 'demo1234' }).body;
    expect(demoServer('PUT', `/admin/drivers/${drv.user.id}/reject`, {}, adm.accessToken).status).toBe(400);
    demoServer('PUT', `/admin/drivers/${drv.user.id}/reject`, { reason: 'Licence photo is blurry' }, adm.accessToken);
    expect(demoServer('GET', '/drivers/profile', undefined, drv.accessToken).body.profile.statusReason).toBe('Licence photo is blurry');
  });
  it('admin login rejects a wrong password; pricing change keeps history', () => {
    expect(demoServer('POST', '/auth/admin/login', { email: 'admin@example.com', password: 'x' }).status).toBe(401);
    const adm = demoServer('POST', '/auth/admin/login', { email: 'admin@example.com', password: 'demo1234' }).body;
    expect(demoServer('PUT', '/admin/pricing', { minimumPricePerKm: 11 }, adm.accessToken).body.pricing.minimumPricePerKm).toBe(11);
    expect(demoServer('PUT', '/admin/pricing', { minimumPricePerKm: 11 }, adm.accessToken).status).toBe(400);
    expect(demoServer('GET', '/admin/pricing/history', undefined, adm.accessToken).body.history).toHaveLength(2);
  });
  it('restores a session from the stored refresh token', () => {
    const c = login('9000000001', 'CUSTOMER');
    const r = demoServer('POST', '/auth/refresh', { refreshToken: c.refreshToken });
    expect(demoServer('GET', '/auth/me', undefined, r.body.accessToken).body.user.role).toBe('CUSTOMER');
  });
});
