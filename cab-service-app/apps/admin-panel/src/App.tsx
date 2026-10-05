import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useAuth } from './auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Drivers from './pages/Drivers';
import Verification from './pages/Verification';
import Pricing from './pages/Pricing';
import Settings from './pages/Settings';
import Pending from './pages/Pending';

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { status } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <div className="login" aria-busy="true" style={{ color: '#fff' }}>Loading…</div>;
  if (status === 'out') return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
  return children;
}

const P = (title: string, module: string, what: string) => <Pending title={title} module={module} what={what} />;

export default function App() {
  return (
    <Routes>
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="verification" element={<Verification />} />
        <Route path="vehicles" element={P('Vehicles', 'the driver documents module', 'Vehicles and their documents are added when drivers can upload them.')} />
        <Route path="bookings" element={P('Bookings', 'the booking module', 'No bookings can be made until booking is built.')} />
        <Route path="active-rides" element={P('Active Rides', 'the booking and live-tracking modules', 'Rides in progress will be listed here.')} />
        <Route path="shared-rides" element={P('Shared Rides', 'the shared-rides module', 'Shared journeys, seats and passengers will be listed here.')} />
        <Route path="payments" element={P('Payments', 'the payments module', 'Payments and refunds will be listed here.')} />
        <Route path="earnings" element={P('Earnings', 'the payments module', 'Driver earnings and commission will be listed here.')} />
        <Route path="ratings" element={P('Ratings', 'the ratings module', 'Ratings and reviews will be listed here.')} />
        <Route path="complaints" element={P('Complaints', 'the ratings and complaints module', 'Customer and driver complaints will be listed here.')} />
        <Route path="notifications" element={P('Notifications', 'the notifications module', 'Announcements and push-notification history will be here.')} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="reports" element={P('Reports', 'the reports module', 'Revenue and activity reports will be here.')} />
        <Route path="admin-users" element={P('Admin Users', 'the admin-users module', 'Adding and removing staff accounts will be here.')} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
