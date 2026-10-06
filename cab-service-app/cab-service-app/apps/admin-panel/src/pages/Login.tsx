import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { IS_DEMO } from '../api';

export default function Login() {
  const { status, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (status === 'in') return <Navigate to="/admin/dashboard" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await login(email.trim(), password); } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="login">
      <form onSubmit={submit}>
        <h1>Admin sign in</h1>
        <p className="sub">RR Cabs staff only. Every action is logged.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div style={{ marginBottom: 12 }}><label htmlFor="email">Email</label><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div style={{ marginBottom: 16 }}><label htmlFor="pw">Password</label><input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {IS_DEMO && <p className="sub" style={{ background: '#FFF1DC', padding: 10, borderRadius: 10 }}>DEMO with sample data. Email <b>admin@example.com</b>, password <b>demo1234</b>.</p>}
        <button className="btn navy" style={{ width: '100%' }} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
