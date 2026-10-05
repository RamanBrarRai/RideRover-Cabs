import { useState } from 'react';
import { api } from '../api';
import { useFetch } from '../useFetch';
import { Empty, ErrorBox, Loading, PageHead, Pill, maskPhone } from '../ui';

export default function Verification() {
  const { data, error, loading, reload } = useFetch<{ drivers: any[] }>('/admin/drivers?status=PENDING_VERIFICATION&limit=100');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function decide(id: string, action: 'approve' | 'reject', why?: string) {
    setBusy(true); setMsg(null);
    try {
      await api(`/admin/drivers/${id}/${action}`, { method: 'PUT', body: JSON.stringify(why ? { reason: why } : {}) });
      setMsg({ ok: true, text: action === 'approve' ? 'Driver approved. They can now go online.' : 'Driver rejected. They were told the reason.' });
      setRejecting(null); setReason(''); await reload();
    } catch (e: any) { setMsg({ ok: false, text: e.message }); } finally { setBusy(false); }
  }
  return (<><PageHead title="Driver Verification" sub="Drivers waiting for a decision. Only verified drivers can receive rides." />
    {msg && <div className={msg.ok ? 'success' : 'error'} role="status">{msg.text}</div>}
    {loading && <Loading />}{error && <ErrorBox message={error} retry={reload} />}
    {data && (data.drivers.length === 0 ? <div className="panel"><Empty title="Nobody is waiting" text="New drivers show up here after they submit their details." /></div> :
      <div className="panel"><table><thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Status</th><th>Decision</th></tr></thead>
        <tbody>{data.drivers.map((d) => <tr key={d.id}><td>{d.fullName ?? '—'}</td><td>{maskPhone(d.phone)}</td><td>{d.address ?? '—'}</td><td><Pill value={d.status} /></td>
          <td className="row"><button className="btn" disabled={busy} onClick={() => decide(d.id, 'approve')}>Approve</button>
            <button className="btn bad" disabled={busy} onClick={() => setRejecting(d)}>Reject</button></td></tr>)}</tbody></table>
        <p className="sub" style={{ margin: '12px 0 0' }}>Document review (licence, registration, insurance) arrives with the document-upload module. Until then approval checks that the driver finished their profile.</p></div>)}
    {rejecting && <div className="modal" role="dialog" aria-modal="true" aria-label="Reject driver"><div>
      <h2 style={{ marginTop: 0 }}>Reject {rejecting.fullName}?</h2>
      <label htmlFor="why">Reason (the driver will see this)</label>
      <textarea id="why" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
        <button className="btn ghost" onClick={() => setRejecting(null)}>Cancel</button>
        <button className="btn bad" disabled={busy || reason.trim().length < 5} onClick={() => decide(rejecting.id, 'reject', reason.trim())}>Reject driver</button></div>
    </div></div>}</>);
}
