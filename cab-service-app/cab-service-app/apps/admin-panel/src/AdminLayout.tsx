import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { IS_DEMO } from './api';
import { useEffect } from 'react';

export const NAV: [string, string][] = [
  ['dashboard', 'Dashboard'], ['customers', 'Customers'], ['drivers', 'Drivers'], ['verification', 'Driver Verification'],
  ['vehicles', 'Vehicles'], ['bookings', 'Bookings'], ['active-rides', 'Active Rides'], ['shared-rides', 'Shared Rides'],
  ['payments', 'Payments'], ['earnings', 'Earnings'], ['ratings', 'Ratings'], ['complaints', 'Complaints'],
  ['notifications', 'Notifications'], ['pricing', 'Pricing'], ['reports', 'Reports'], ['admin-users', 'Admin Users'], ['settings', 'Settings'],
];

/** The shell: sidebar + page area. It stays mounted while the page inside <Outlet/> changes. */
export default function AdminLayout() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">RR <span>Cabs</span> Admin</div>
        <nav className="nav" aria-label="Admin navigation">
          {NAV.map(([path, label]) => <NavLink key={path} to={`/admin/${path}`}>{label}</NavLink>)}
        </nav>
        <button className="signout" onClick={logout}>Sign out</button>
      </aside>
      <div className="main">
        <div className="topbar"><button onClick={() => setOpen(true)} aria-label="Open menu">☰ Menu</button><b>RR Cabs Admin</b></div>
        <main className="content">{IS_DEMO && <div className="success" style={{ background: '#FFF1DC', color: '#8A4B00' }}>DEMO with sample data. Changes are saved only in this browser.</div>}<Outlet /></main>
      </div>
    </div>
  );
}
