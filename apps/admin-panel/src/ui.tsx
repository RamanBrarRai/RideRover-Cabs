import { ReactNode } from 'react';

export const Loading = () => <div aria-busy="true" aria-label="Loading"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" style={{ width: '60%' }} /></div>;
export const ErrorBox = ({ message, retry }: { message: string; retry?: () => void }) => (
  <div className="error" role="alert">{message} {retry && <button className="btn ghost" onClick={retry} style={{ marginLeft: 8 }}>Try again</button>}</div>);
export const Empty = ({ title, text }: { title: string; text?: string }) => <div className="state"><b>{title}</b>{text}</div>;
export const PageHead = ({ title, sub }: { title: string; sub?: string }) => <><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</>;

export function Pill({ value }: { value: string }) {
  const good = ['VERIFIED', 'ACTIVE', 'SUCCESS'].includes(value), bad = ['REJECTED', 'SUSPENDED', 'FAILED'].includes(value);
  const warn = ['PENDING_VERIFICATION', 'DRAFT', 'NOT_STARTED', 'PENDING'].includes(value);
  return <span className={`pill ${good ? 'ok' : bad ? 'bad' : warn ? 'warn' : ''}`}>{value.replace(/_/g, ' ').toLowerCase()}</span>;
}
export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const date = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const maskPhone = (p?: string | null) => (p ? 'XXXXXX' + p.slice(-4) : '—');
