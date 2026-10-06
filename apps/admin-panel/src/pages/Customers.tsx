import { useFetch } from '../useFetch';
import { Empty, ErrorBox, Loading, PageHead, Pill, date, maskPhone } from '../ui';

export default function Customers() {
  const { data, error, loading, reload } = useFetch<{ customers: any[] }>('/admin/customers?limit=100');
  return (<><PageHead title="Customers" sub="Phone numbers are masked." />
    {loading && <Loading />}{error && <ErrorBox message={error} retry={reload} />}
    {data && (data.customers.length === 0 ? <div className="panel"><Empty title="No customers yet" text="Customers appear here after they sign up in the app." /></div> :
      <div className="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>Identity check</th><th>Account</th><th>Joined</th></tr></thead>
        <tbody>{data.customers.map((c) => <tr key={c.id}><td>{c.fullName ?? '—'}</td><td>{maskPhone(c.phone)}</td><td><Pill value={c.kycStatus} /></td><td><Pill value={c.status} /></td><td>{date(c.createdAt)}</td></tr>)}</tbody></table></div>)}</>);
}
