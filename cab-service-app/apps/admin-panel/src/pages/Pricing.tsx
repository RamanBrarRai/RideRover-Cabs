import { FormEvent, useEffect, useState } from 'react';
import { api } from '../api';
import { useFetch } from '../useFetch';
import { Empty, ErrorBox, Loading, PageHead, date } from '../ui';

const FIELDS: { key: string; label: string; unit: string; group: string; step?: string; nullable?: boolean }[] = [
  { key: 'minimumPricePerKm', label: 'Minimum price per km', unit: '₹/km', group: 'Fares', step: '0.01' },
  { key: 'baseFare', label: 'Base fare', unit: '₹', group: 'Fares' },
  { key: 'perMinuteFare', label: 'Per-minute fare', unit: '₹/min', group: 'Fares', step: '0.01' },
  { key: 'minimumFare', label: 'Minimum fare', unit: '₹', group: 'Fares' },
  { key: 'maximumFare', label: 'Maximum fare (blank = no limit)', unit: '₹', group: 'Fares', nullable: true },
  { key: 'suvMultiplier', label: 'SUV price multiplier', unit: '×', group: 'Fares', step: '0.01' },
  { key: 'tollPer100km', label: 'Toll estimate', unit: '₹ per 100 km', group: 'Charges' },
  { key: 'waitingFeePerHour', label: 'Waiting fee', unit: '₹/hour', group: 'Charges' },
  { key: 'cancellationFee', label: 'Cancellation fee', unit: '₹', group: 'Charges' },
  { key: 'platformFee', label: 'Platform fee', unit: '₹', group: 'Charges' },
  { key: 'driverCommissionPct', label: 'Platform commission from drivers', unit: '%', group: 'Charges', step: '0.01' },
  { key: 'sharedSeatFactor', label: 'Shared seat share of per-km rate', unit: '× (0 to 1)', group: 'Shared rides', step: '0.001' },
  { key: 'minSeatFare', label: 'Minimum fare per seat', unit: '₹', group: 'Shared rides' },
  { key: 'matchExcellentScore', label: 'Excellent match from', unit: 'score', group: 'Route matching' },
  { key: 'matchGoodScore', label: 'Good match from', unit: 'score', group: 'Route matching' },
  { key: 'matchMinScore', label: 'Show matches from', unit: 'score', group: 'Route matching' },
  { key: 'matchRadiusKm', label: 'Pickup / drop search radius', unit: 'km', group: 'Route matching', step: '0.1' },
  { key: 'matchTimeWindowMin', label: 'Departure time window', unit: 'minutes', group: 'Route matching' },
];

export default function Pricing() {
  const cur = useFetch<{ pricing: Record<string, number | null> }>('/admin/pricing');
  const hist = useFetch<{ history: any[] }>('/admin/pricing/history');
  const [form, setForm] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (cur.data) setForm(Object.fromEntries(FIELDS.map((f) => [f.key, cur.data!.pricing[f.key] == null ? '' : String(cur.data!.pricing[f.key])]))); }, [cur.data]);

  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    const patch: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const before = cur.data!.pricing[f.key] ?? null;
      const raw = form[f.key].trim();
      const now = raw === '' ? (f.nullable ? null : NaN) : Number(raw);
      if (Number.isNaN(now)) return setMsg({ ok: false, text: `${f.label} needs a number.` });
      if (now !== before) patch[f.key] = now;
    }
    if (!Object.keys(patch).length) return setMsg({ ok: false, text: 'Nothing has changed.' });
    setBusy(true);
    try {
      await api('/admin/pricing', { method: 'PUT', body: JSON.stringify(patch) });
      setMsg({ ok: true, text: 'Saved. New fares use these prices straight away. No app update is needed.' });
      await Promise.all([cur.reload(), hist.reload()]);
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  }

  const groups = [...new Set(FIELDS.map((f) => f.group))];
  return (<><PageHead title="Pricing" sub="Changes apply to new bookings. Every change is kept in the history below." />
    {cur.loading && <Loading />}{cur.error && <ErrorBox message={cur.error} retry={cur.reload} />}
    {msg && <div className={msg.ok ? 'success' : 'error'} role="status">{msg.text}</div>}
    {cur.data && <form onSubmit={save}>
      {groups.map((g) => <div className="panel" key={g}><h2 style={{ marginTop: 0, fontSize: 17 }}>{g}</h2><div className="form">
        {FIELDS.filter((f) => f.group === g).map((f) => <div key={f.key}><label htmlFor={f.key}>{f.label} <small>({f.unit})</small></label>
          <input id={f.key} type="number" step={f.step ?? '1'} min="0" value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /></div>)}</div></div>)}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save pricing'}</button></form>}
    <h2 style={{ marginTop: 28 }}>History</h2>
    {hist.data && (hist.data.history.length === 0 ? <Empty title="No history" /> : <div className="panel"><table><thead><tr><th>When</th><th>Changed by</th><th>Per km</th><th>Platform fee</th><th>Commission</th><th></th></tr></thead>
      <tbody>{hist.data.history.map((h) => <tr key={h.id}><td>{date(h.createdAt)}</td><td>{h.changedBy ?? 'initial setup'}</td><td>₹{h.minimumPricePerKm}</td><td>₹{h.platformFee}</td><td>{h.driverCommissionPct}%</td><td>{h.isActive && <span className="pill ok">current</span>}</td></tr>)}</tbody></table></div>)}</>);
}
