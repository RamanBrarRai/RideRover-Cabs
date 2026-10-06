import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { publicApi, ApiError } from '../../api';
import { APP_ROLE } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { Button, Field, Screen } from '../../components/ui';
import { isValidOtp, isValidPhone } from '../../validate';
import { colors } from '../../theme';

type P = { Phone: undefined; Otp: { phone: string } };
const Stack = createNativeStackNavigator<P>();

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={{ backgroundColor: colors.navy, borderRadius: 22, padding: 22, marginBottom: 22 }}>
      <Text style={{ color: colors.orange, fontWeight: '800', fontSize: 14, marginBottom: 8 }}>RR CABS{APP_ROLE === 'DRIVER' ? ' DRIVER' : ''}</Text>
      <Text accessibilityRole="header" style={{ color: colors.white, fontSize: 26, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: '#C9D5E4', marginTop: 4 }}>{sub}</Text>
    </View>
  );
}

function PhoneScreen({ navigation }: NativeStackScreenProps<P, 'Phone'>) {
  const { message } = useAuth();
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!isValidPhone(phone)) return setErr('Enter a valid 10-digit mobile number.');
    setErr(null); setBusy(true);
    try { await publicApi('/auth/send-otp', { phone, role: APP_ROLE }); navigation.navigate('Otp', { phone }); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <Header title={APP_ROLE === 'DRIVER' ? 'Drive with RR Cabs' : 'Log in or sign up'} sub={APP_ROLE === 'DRIVER' ? 'Use your mobile number to log in or register.' : 'Enter your mobile number. We will text you a code.'} />
      {!!message && <Text style={{ color: colors.orange, marginBottom: 12, fontWeight: '600' }}>{message}</Text>}
      <Field label="Mobile number" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={10} placeholder="10-digit number" error={err} autoComplete="tel" />
      <Button title="Send code" onPress={send} loading={busy} />
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 16, textAlign: 'center' }}>By continuing you agree to the Terms and Privacy Policy.</Text>
    </Screen>
  );
}

function OtpScreen({ route, navigation }: NativeStackScreenProps<P, 'Otp'>) {
  const { phone } = route.params;
  const { signIn } = useAuth();
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(30);
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function verify() {
    if (!isValidOtp(otp)) return setErr('The code is 6 digits.');
    setErr(null); setBusy(true);
    try {
      const r = await publicApi('/auth/verify-otp', { phone, role: APP_ROLE, otp });
      await signIn({ accessToken: r.accessToken, refreshToken: r.refreshToken }, { id: r.user.id, role: r.user.role });
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); setBusy(false); }
  }
  async function resend() {
    setErr(null);
    try { await publicApi('/auth/send-otp', { phone, role: APP_ROLE }); setWait(30); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); }
  }
  return (
    <Screen>
      <Header title="Enter the code" sub={`Sent to +91 ${phone.slice(0, 2)}XXXXXX${phone.slice(-2)}`} />
      <Field label="6-digit code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={6} placeholder="123456" error={err} autoComplete="sms-otp" textContentType="oneTimeCode" />
      <Button title="Verify" onPress={verify} loading={busy} />
      <View style={{ marginTop: 12, gap: 8 }}>
        <Button title={wait > 0 ? `Resend code in ${wait}s` : 'Resend code'} kind="ghost" disabled={wait > 0} onPress={resend} />
        <Button title="Change number" kind="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Phone" component={PhoneScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
    </Stack.Navigator>
  );
}
