import { useFetch } from '../useFetch';
import { ErrorBox, Loading, PageHead, inr } from '../ui';

interface Stats { totalCustomers: number; activeCustomers: number; totalDrivers: number; verifiedDrivers: number; pendingDrivers: number; activeRides: number; completedRides: number; cancelledRides: number; sharedRides: number; revenue: number; driverEarnings: number; platformCommission: number }

export default function Dashboard() {
  const { data, error, loading, reload } = useFetch<{ stats: Stats }>('/admin/stats');
  const s = data?.stats;
  const items: [string, string | number][] = s ? [
    ['Total customers', s.totalCustomers], ['Active customers (30 days)', s.activeCustomers], ['Total drivers', s.totalDrivers],
    ['Verified drivers', s.verifiedDrivers], ['Pending verification', s.pendingDrivers], ['Active rides', s.activeRides],
    ['Completed rides', s.completedRides], ['Cancelled rides', s.cancelledRides], ['Shared rides', s.sharedRides],
    ['Revenue', inr(s.revenue)], ['Driver earnings', inr(s.driverEarnings)], ['Platform commission', inr(s.platformCommission)],
  ] : [];
  return (<><PageHead title="Dashboard" sub="Live numbers from the database." />
    {loading && <Loading />}{error && <ErrorBox message={error} retry={reload} />}
    <div className="cards">{items.map(([k, v]) => <div className="card" key={k}><div className="k">{k}</div><div className="v">{v}</div></div>)}</div></>);
}
