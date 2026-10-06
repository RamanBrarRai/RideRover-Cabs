import { useAuth } from '../auth';
import { PageHead } from '../ui';

export default function Settings() {
  const { admin, logout } = useAuth();
  return (<><PageHead title="Settings" />
    <div className="panel"><h2 style={{ marginTop: 0, fontSize: 17 }}>Your account</h2><p>Signed in as <b>{admin?.email}</b></p><button className="btn navy" onClick={logout}>Sign out</button></div>
    <div className="panel"><h2 style={{ marginTop: 0, fontSize: 17 }}>Platform settings</h2><p className="sub">Pricing is on the Pricing page. Other platform settings (support contacts, announcement defaults) are added in the notifications module.</p></div></>);
}
