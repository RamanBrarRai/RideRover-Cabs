import { useState } from 'react';
import { useFetch } from '../useFetch';
import { Empty, ErrorBox, Loading, PageHead, Pill, date, maskPhone } from '../ui';

export default function Drivers() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useFetch<{ drivers: any[] }>(`/admin/drivers?limit=100${status ? `&status=${status}` : ''}`);
  return (<><PageHead title="Drivers" />
    <div className="row" style={{ marginBottom: 12 }}><label htmlFor="st" style={{ margin: 0 }}>Show</label>
      <select id="st" style={{ width: 220 }} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="">All drivers</option>{['DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}
      </select></div>
    {loading && <Loading />}{error && <ErrorBox message={error} retry={reload} />}
    {data && (data.drivers.length === 0 ? <div className="panel"><Empty title="No drivers found" /></div> :
      <div className="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>Verification</th><th>Online</th><th>Joined</th></tr></thead>
        <tbody>{data.drivers.map((d) => <tr key={d.id}><td>{d.fullName ?? '—'}</td><td>{maskPhone(d.phone)}</td><td><Pill value={d.status} /></td><td>{d.isOnline ? 'Yes' : 'No'}</td><td>{date(d.createdAt)}</td></tr>)}</tbody></table></div>)}</>);
}
