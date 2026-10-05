// Pure rules that decide which part of the app a person sees. Kept free of React so they can be tested.
export type Role = 'CUSTOMER' | 'DRIVER' | 'ADMIN';

export type Gate =
  | 'LOADING' | 'CONNECTION_PROBLEM' | 'ONBOARDING' | 'AUTH' | 'PROFILE_SETUP' | 'WRONG_APP'
  | 'CUSTOMER_APP' | 'DRIVER_APP' | 'DRIVER_VERIFICATION_APP';

export interface GateInput {
  auth: 'loading' | 'out' | 'in' | 'error';
  role?: Role;
  appRole: 'CUSTOMER' | 'DRIVER';
  seenOnboarding: boolean;
  profile: 'loading' | 'ready' | 'error';
  needsSetup: boolean;
  driverStatus?: string | null;
}

export function resolveGate(i: GateInput): Gate {
  if (i.auth === 'loading') return 'LOADING';
  if (i.auth === 'error') return 'CONNECTION_PROBLEM';
  if (i.auth === 'out') return i.seenOnboarding ? 'AUTH' : 'ONBOARDING';
  if (i.role !== i.appRole) return 'WRONG_APP';          // a customer in the driver app, a driver in the customer app, or an admin in either
  if (i.profile === 'error') return 'CONNECTION_PROBLEM';
  if (i.profile === 'loading') return 'LOADING';
  if (i.needsSetup) return 'PROFILE_SETUP';
  if (i.appRole === 'CUSTOMER') return 'CUSTOMER_APP';
  return i.driverStatus === 'VERIFIED' ? 'DRIVER_APP' : 'DRIVER_VERIFICATION_APP';
}

export const CUSTOMER_TABS = ['Home', 'Rides', 'Activity', 'Messages', 'Profile'] as const;
export const DRIVER_TABS = ['Home', 'Requests', 'Trips', 'Earnings', 'Profile'] as const;
export const DRIVER_UNVERIFIED_TABS = ['Home', 'Documents', 'Trips', 'Profile'] as const;

export function tabsFor(gate: Gate): readonly string[] {
  if (gate === 'CUSTOMER_APP') return CUSTOMER_TABS;
  if (gate === 'DRIVER_APP') return DRIVER_TABS;
  if (gate === 'DRIVER_VERIFICATION_APP') return DRIVER_UNVERIFIED_TABS;
  return [];
}

/** Which part of the system each role may open. */
export function canOpen(role: Role, area: 'customer' | 'driver' | 'admin'): boolean {
  return (role === 'CUSTOMER' && area === 'customer') || (role === 'DRIVER' && area === 'driver') || (role === 'ADMIN' && area === 'admin');
}
