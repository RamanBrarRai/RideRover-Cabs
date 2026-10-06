import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_ROLE } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError } from '../../api';
import { useProfile } from '../../navigation/ProfileProvider';
import { Button, ErrorState, Field, H1, Screen, Body } from '../../components/ui';
import { useState } from 'react';
import { isValidEmail } from '../../validate';
import { colors } from '../../theme';

export function Splash() {
  return (
    <View accessibilityLabel="Loading" style={{ flex: 1, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="car-sport" size={56} color={colors.orange} />
      <Text style={{ color: colors.white, fontSize: 30, fontWeight: '800', marginTop: 10 }}>RR <Text style={{ color: colors.orange }}>Cabs</Text></Text>
    </View>
  );
}

export function ConnectionProblem() {
  const auth = useAuth(); const prof = useProfile();
  return <Screen><View style={{ height: 80 }} /><ErrorState message={auth.message ?? prof.error ?? 'Cannot reach the server.'} onRetry={() => (auth.status === 'error' ? auth.retry() : prof.refresh())} /></Screen>;
}

export function WrongApp() {
  const { signOut } = useAuth();
  const other = APP_ROLE === 'CUSTOMER' ? 'driver' : 'customer';
  return (
    <Screen>
      <View style={{ height: 60 }} />
      <H1>Wrong app for this account</H1>
      <Body muted style={{ marginVertical: 12 }}>This is the {APP_ROLE.toLowerCase()} app, but you are signed in with a different kind of account. Please log out and use the {other} app instead.</Body>
      <Button title="Log out" onPress={signOut} />
    </Screen>
  );
}

/** First login: collect the name (and address for drivers) before showing the app. */
export function ProfileSetup() {
  const { profile, setProfile } = useProfile();
  const { signOut } = useAuth();
  const driver = APP_ROLE === 'DRIVER';
  const [name, setName] = useState(profile?.fullName ?? '');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState<string | null>(null);

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (driver && address.trim().length < 5) e.address = 'Enter your address (at least 5 characters).';
    if (!driver && email && !isValidEmail(email)) e.email = 'That email does not look right. Leave it blank to skip.';
    setErr(e); setTop(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await api<{ profile: any }>(driver ? '/drivers/profile' : '/customers/profile', { method: 'PUT', body: JSON.stringify(driver ? { fullName: name.trim(), address: address.trim() } : { fullName: name.trim(), ...(email ? { email } : {}) }) });
      setProfile(r.profile);
    } catch (x) { setTop(x instanceof ApiError ? x.message : 'Something went wrong.'); setBusy(false); }
  }
  return (
    <Screen>
      <H1>Tell us about you</H1>
      <Body muted style={{ marginTop: 4, marginBottom: 20 }}>{driver ? 'Step 1 of 2. Next you will add your documents.' : 'Drivers only see your first name and pickup point.'}</Body>
      {!!top && <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: 12 }}>{top}</Text>}
      <Field label="Full name" value={name} onChangeText={setName} error={err.name} autoComplete="name" />
      {driver ? <Field label="Address" value={address} onChangeText={setAddress} error={err.address} multiline /> : <Field label="Email (optional)" value={email} onChangeText={setEmail} error={err.email} keyboardType="email-address" autoCapitalize="none" />}
      <Button title="Continue" onPress={save} loading={busy} />
      <View style={{ marginTop: 10 }}><Button title="Log out" kind="ghost" onPress={signOut} /></View>
    </Screen>
  );
}
