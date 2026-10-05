import { describe, expect, it } from 'vitest';
import { canOpen, resolveGate, tabsFor, GateInput } from './guards';

const base: GateInput = { auth: 'in', role: 'CUSTOMER', appRole: 'CUSTOMER', seenOnboarding: true, profile: 'ready', needsSetup: false };

describe('which screen a person lands on', () => {
  it('shows a loading screen while restoring the session', () => expect(resolveGate({ ...base, auth: 'loading' })).toBe('LOADING'));
  it('shows onboarding to a first-time visitor, then login', () => {
    expect(resolveGate({ ...base, auth: 'out', seenOnboarding: false })).toBe('ONBOARDING');
    expect(resolveGate({ ...base, auth: 'out' })).toBe('AUTH');
  });
  it('never shows login again to someone already signed in (session persistence)', () => {
    expect(resolveGate(base)).toBe('CUSTOMER_APP');
    expect(resolveGate({ ...base, role: 'DRIVER', appRole: 'DRIVER', driverStatus: 'VERIFIED' })).toBe('DRIVER_APP');
  });
  it('asks a new user to finish their profile first', () => expect(resolveGate({ ...base, needsSetup: true })).toBe('PROFILE_SETUP'));
  it('keeps the wrong role out of each app', () => {
    expect(resolveGate({ ...base, role: 'DRIVER', appRole: 'CUSTOMER' })).toBe('WRONG_APP');
    expect(resolveGate({ ...base, role: 'CUSTOMER', appRole: 'DRIVER' })).toBe('WRONG_APP');
    expect(resolveGate({ ...base, role: 'ADMIN', appRole: 'CUSTOMER' })).toBe('WRONG_APP');
    expect(resolveGate({ ...base, role: 'ADMIN', appRole: 'DRIVER' })).toBe('WRONG_APP');
  });
  it('puts unverified drivers on the verification dashboard, never on ride screens', () => {
    for (const s of ['DRAFT', 'PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED', null, undefined])
      expect(resolveGate({ ...base, role: 'DRIVER', appRole: 'DRIVER', driverStatus: s })).toBe('DRIVER_VERIFICATION_APP');
  });
  it('shows a retry screen when the server cannot be reached', () => {
    expect(resolveGate({ ...base, auth: 'error' })).toBe('CONNECTION_PROBLEM');
    expect(resolveGate({ ...base, profile: 'error' })).toBe('CONNECTION_PROBLEM');
  });
});

describe('tabs', () => {
  it('gives customers exactly their five tabs', () => expect(tabsFor('CUSTOMER_APP')).toEqual(['Home', 'Rides', 'Activity', 'Messages', 'Profile']));
  it('gives verified drivers exactly their five tabs', () => expect(tabsFor('DRIVER_APP')).toEqual(['Home', 'Requests', 'Trips', 'Earnings', 'Profile']));
  it('gives unverified drivers a restricted set with Documents and no Requests', () => {
    expect(tabsFor('DRIVER_VERIFICATION_APP')).toEqual(['Home', 'Documents', 'Trips', 'Profile']);
    expect(tabsFor('DRIVER_VERIFICATION_APP')).not.toContain('Requests');
  });
  it('shows no tabs on login, onboarding or error screens', () => {
    for (const g of ['LOADING', 'ONBOARDING', 'AUTH', 'PROFILE_SETUP', 'WRONG_APP', 'CONNECTION_PROBLEM'] as const) expect(tabsFor(g)).toEqual([]);
  });
  it('shares no tab set between customer and driver apps beyond Home, Trips-like names and Profile', () => {
    expect(tabsFor('CUSTOMER_APP')).not.toContain('Requests');
    expect(tabsFor('DRIVER_APP')).not.toContain('Messages');
    expect(tabsFor('DRIVER_APP')).not.toContain('Rides');
  });
});

describe('area access', () => {
  it('lets each role open only its own area', () => {
    expect(canOpen('CUSTOMER', 'customer')).toBe(true);
    expect(canOpen('CUSTOMER', 'driver')).toBe(false);
    expect(canOpen('CUSTOMER', 'admin')).toBe(false);
    expect(canOpen('DRIVER', 'driver')).toBe(true);
    expect(canOpen('DRIVER', 'customer')).toBe(false);
    expect(canOpen('DRIVER', 'admin')).toBe(false);
    expect(canOpen('ADMIN', 'admin')).toBe(true);
    expect(canOpen('ADMIN', 'customer')).toBe(false);
    expect(canOpen('ADMIN', 'driver')).toBe(false);
  });
});
