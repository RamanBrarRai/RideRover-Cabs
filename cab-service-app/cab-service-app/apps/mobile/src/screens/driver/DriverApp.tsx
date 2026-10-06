import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useProfile } from '../../navigation/ProfileProvider';
import { useApi } from '../../useApi';
import { Avatar, Body, Button, Card, Confirm, EmptyState, ErrorState, Field, H1, H2, LoadingBlock, MapArea, Pill, Row, Screen, Segmented, useToast } from '../../components/ui';
import { colors, space } from '../../theme';
import { firstName, greeting, inr } from '../../validate';

interface Summary { todayEarnings: number; todayTrips: number; weekEarnings: number; weekTrips: number; monthEarnings: number; monthTrips: number; totalGross: number; totalCommission: number; totalNet: number; ratingAvg: number; ratingCount: number; isOnline: boolean }
interface Docs { status: string; reason: string | null; profileComplete: boolean; documents: { type: string; status: string; note: string | null }[] }

const Tab = createBottomTabNavigator();
const Root = createNativeStackNavigator();

// ---------------- Verified: Home ----------------
function Home() {
  const { profile, refresh } = useProfile();
  const toast = useToast();
  const s = useApi<Summary>('/drivers/summary');
  const [busy, setBusy] = useState(false);
  useFocusEffect(useCallback(() => { s.reload(); refresh(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const online = !!profile?.isOnline;
  async function toggle() {
    setBusy(true);
    try { await api('/drivers/online', { method: 'POST', body: JSON.stringify({ online: !online }) }); await refresh(); toast(online ? 'You are offline.' : 'You are online. Requests will appear here.'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Could not change status.', 'bad'); } finally { setBusy(false); }
  }
  return (
    <Screen onRefresh={() => { s.reload(); refresh(); }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
        <View style={{ flex: 1 }}><Text style={{ color: colors.muted }}>{greeting()}</Text><Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy }}>{firstName(profile?.fullName)}</Text></View>
        <Avatar name={profile?.fullName} />
      </View>
      <View style={{ backgroundColor: colors.navy, borderRadius: 22, padding: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: online ? colors.success : '#8795A8', marginRight: 8 }} />
          <Text style={{ color: colors.white, fontWeight: '700', fontSize: 16 }}>{online ? 'You are online' : 'You are offline'}</Text>
        </View>
        <Button title={online ? 'GO OFFLINE' : 'GO ONLINE'} kind={online ? 'ghost' : 'primary'} onPress={toggle} loading={busy} />
      </View>
      {s.loading && !s.data ? <LoadingBlock /> : s.error && !s.data ? <ErrorState message={s.error} onRetry={s.reload} /> : s.data && (
        <>
          <Card><Text style={{ color: colors.muted }}>Today's earnings</Text><Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>{inr(s.data.todayEarnings)}</Text>
            <View style={{ flexDirection: 'row', marginTop: 10 }}>
              <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 13 }}>Trips today</Text><Text style={{ fontWeight: '800', fontSize: 18 }}>{s.data.todayTrips}</Text></View>
              <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 13 }}>Rating</Text><Text style={{ fontWeight: '800', fontSize: 18 }}>{s.data.ratingCount ? `★ ${Number(s.data.ratingAvg).toFixed(1)}` : 'No ratings yet'}</Text></View>
            </View></Card>
        </>)}
      <MapArea height={150} />
      <View style={{ height: space.md }} />
      <Card><Text style={{ fontWeight: '700' }}>Current ride</Text><Body muted>No active trip.</Body></Card>
      <Card><Text style={{ fontWeight: '700' }}>Ride requests</Text><Body muted>{online ? 'No requests right now. They will appear in the Requests tab.' : 'Go online to receive ride requests.'}</Body></Card>
    </Screen>);
}

function Requests() {
  const { profile } = useProfile();
  const online = !!profile?.isOnline;
  return (<Screen><H1>Requests</H1><View style={{ height: 14 }} />
    <EmptyState icon={online ? 'notifications-outline' : 'power-outline'} title={online ? 'No requests right now' : 'You are offline'} text={online ? 'New outstation and shared-ride requests will appear here with Accept and Reject buttons.' : 'Go online from the Home tab to start receiving ride requests.'} /></Screen>);
}

function Trips() {
  const [seg, setSeg] = useState('Upcoming');
  return (<Screen><H1>Trips</H1><View style={{ height: 14 }} />
    <Segmented options={['Upcoming', 'Active', 'Completed', 'Cancelled']} value={seg} onChange={setSeg} />
    <EmptyState icon="car-outline" title={`No ${seg.toLowerCase()} trips`} text="Your trips will be listed here." /></Screen>);
}

function Earnings() {
  const s = useApi<Summary>('/drivers/summary');
  useFocusEffect(useCallback(() => { s.reload(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const Box = ({ label, v, trips }: { label: string; v: number; trips: number }) => (
    <Card><Text style={{ color: colors.muted }}>{label}</Text><Text style={{ fontSize: 30, fontWeight: '800' }}>{inr(v)}</Text><Text style={{ color: colors.muted, fontSize: 13 }}>{trips} trip{trips === 1 ? '' : 's'}</Text></Card>);
  return (
    <Screen onRefresh={s.reload}><H1>Earnings</H1><View style={{ height: 14 }} />
      {s.loading && !s.data ? <LoadingBlock /> : s.error && !s.data ? <ErrorState message={s.error} onRetry={s.reload} /> : s.data && (<>
        <Box label="Today" v={s.data.todayEarnings} trips={s.data.todayTrips} />
        <Box label="This week" v={s.data.weekEarnings} trips={s.data.weekTrips} />
        <Box label="This month" v={s.data.monthEarnings} trips={s.data.monthTrips} />
        <Card><H2>All time</H2><View style={{ height: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text>Fares collected</Text><Text style={{ fontWeight: '700' }}>{inr(s.data.totalGross)}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}><Text>Platform commission</Text><Text style={{ fontWeight: '700' }}>− {inr(s.data.totalCommission)}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 4 }}><Text style={{ fontWeight: '800' }}>Net earnings</Text><Text style={{ fontWeight: '800' }}>{inr(s.data.totalNet)}</Text></View></Card>
        {s.data.totalNet === 0 && <EmptyState icon="wallet-outline" title="No earnings yet" text="Completed trips and their payouts will be listed here." />}
      </>)}
    </Screen>);
}

// ---------------- Profile (both modes) ----------------
function Profile() {
  const nav = useNavigation<any>();
  const { profile, setProfile } = useProfile();
  const { signOut } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.fullName ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const later = (w: string) => () => toast(`${w} is coming in a later update.`);
  const verified = profile?.status === 'VERIFIED';

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (address.trim().length < 5) e.address = 'Enter your address.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { const r = await api<{ profile: any }>('/drivers/profile', { method: 'PUT', body: JSON.stringify({ fullName: name.trim(), address: address.trim() }) }); setProfile(r.profile); setEditing(false); toast('Profile saved.'); }
    catch (x) { setErr({ top: x instanceof ApiError ? x.message : 'Something went wrong.' }); } finally { setBusy(false); }
  }
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Avatar name={profile?.fullName} size={84} />
        <Text style={{ fontSize: 22, fontWeight: '800', marginTop: 10 }}>{profile?.fullName}</Text>
        <Text style={{ color: colors.muted }}>+91 {profile?.phone}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}><Pill text={verified ? 'Verified driver' : (profile?.status ?? '').replace(/_/g, ' ').toLowerCase()} tone={verified ? 'ok' : 'warn'} />{!!profile?.ratingCount && <Pill text={`★ ${Number(profile.ratingAvg).toFixed(1)}`} />}</View>
      </View>
      {editing ? (
        <Card>
          {!!err.top && <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: 8 }}>{err.top}</Text>}
          <Field label="Full name" value={name} onChangeText={setName} error={err.name} />
          <Field label="Address" value={address} onChangeText={setAddress} error={err.address} multiline />
          <View style={{ gap: 8 }}><Button title="Save" onPress={save} loading={busy} /><Button title="Cancel" kind="ghost" onPress={() => setEditing(false)} /></View>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="person-outline" title="Personal information" onPress={() => { setName(profile?.fullName ?? ''); setAddress(profile?.address ?? ''); setEditing(true); }} />
          <Row icon="document-text-outline" title="Documents" onPress={() => (verified ? nav.navigate('Documents') : nav.navigate('Tabs', { screen: 'Documents' }))} />
          <Row icon="car-outline" title="Vehicle" onPress={later('Vehicle details')} />
          <Row icon="business-outline" title="Bank / payout details" onPress={later('Payout details')} />
          <Row icon="settings-outline" title="Settings" onPress={later('Settings')} />
          <Row icon="help-circle-outline" title="Help" onPress={later('Help')} />
        </Card>)}
      <View style={{ marginTop: 6 }}><Button title="Log out" kind="danger" icon="log-out-outline" onPress={() => setAsk(true)} /></View>
      <Confirm visible={ask} title="Log out?" text="You will go offline and need a new code to log in again." confirmText="Log out" danger onConfirm={() => { setAsk(false); signOut(); }} onCancel={() => setAsk(false)} />
    </Screen>);
}

// ---------------- Verification (unverified drivers) ----------------
type Item = { key: string; label: string; state: 'done' | 'review' | 'todo' | 'fix'; note?: string };
function checklist(d: Docs): Item[] {
  const doc = (t: string): Item['state'] => {
    const x = d.documents.find((q) => q.type === t);
    return !x ? 'todo' : x.status === 'APPROVED' ? 'done' : x.status === 'UPLOADED' ? 'review' : 'fix';
  };
  const mk = (key: string, label: string, t: string): Item => { const x = d.documents.find((q) => q.type === t); return { key, label, state: doc(t), note: x?.note ?? undefined }; };
  return [
    { key: 'phone', label: 'Phone number', state: 'done' },
    { key: 'profile', label: 'Profile', state: d.profileComplete ? 'done' : 'todo' },
    mk('id', 'Identity', 'IDENTITY'), mk('lic', 'Driving licence', 'LICENCE'), mk('reg', 'Vehicle registration', 'REGISTRATION'), mk('ins', 'Insurance', 'INSURANCE'),
  ];
}
const mark = { done: ['checkmark-circle', colors.success, 'Verified'], review: ['time', colors.orange, 'Under review'], todo: ['ellipse-outline', colors.muted, 'Not added'], fix: ['alert-circle', colors.error, 'Upload again'] } as const;

function VerificationHome() {
  const nav = useNavigation<any>();
  const { profile, refresh } = useProfile();
  const d = useApi<Docs>('/drivers/verification-status');
  useFocusEffect(useCallback(() => { d.reload(); refresh(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  const st = profile?.status ?? 'DRAFT';
  const tone = st === 'REJECTED' || st === 'SUSPENDED' ? 'bad' : 'warn';
  const label = st === 'PENDING_VERIFICATION' ? 'Pending review' : st === 'DRAFT' ? 'Documents needed' : st.charAt(0) + st.slice(1).toLowerCase();
  return (
    <Screen onRefresh={() => { d.reload(); refresh(); }}>
      <Text style={{ color: colors.muted }}>{greeting()}</Text>
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy, marginBottom: 14 }}>{firstName(profile?.fullName)}</Text>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><H2>Driver verification</H2><Pill text={label} tone={tone} /></View>
        {!!profile?.statusReason && <Text style={{ color: colors.error, marginTop: 8 }}>{profile.statusReason}</Text>}
        <Body muted style={{ marginTop: 8 }}>{st === 'PENDING_VERIFICATION' ? 'We are checking your details. We will notify you when you are approved.' : 'You can receive ride requests after your documents are verified.'}</Body>
      </Card>
      {d.loading && !d.data ? <LoadingBlock /> : d.error && !d.data ? <ErrorState message={d.error} onRetry={d.reload} /> : d.data && (
        <Card style={{ paddingVertical: 4 }}>
          {checklist(d.data).map((it) => { const m = mark[it.state]; return (
            <View key={it.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <Ionicons name={m[0]} size={24} color={m[1]} />
              <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ fontWeight: '600' }}>{it.label}</Text>{!!it.note && <Text style={{ color: colors.error, fontSize: 12 }}>{it.note}</Text>}</View>
              <Text style={{ color: m[1], fontWeight: '700', fontSize: 13 }}>{m[2]}</Text>
            </View>); })}
        </Card>)}
      <Button title="Complete documents" onPress={() => nav.navigate('Documents')} />
    </Screen>);
}

export function Documents() {
  const toast = useToast();
  const d = useApi<Docs>('/drivers/verification-status');
  return (
    <Screen onRefresh={d.reload}><H1>Documents</H1><Body muted style={{ marginVertical: 8 }}>Your documents are stored privately. Only the RR Cabs verification team can open them.</Body>
      {d.loading && !d.data ? <LoadingBlock /> : d.error && !d.data ? <ErrorState message={d.error} onRetry={d.reload} /> : d.data && checklist(d.data).filter((i) => !['phone', 'profile'].includes(i.key)).map((it) => { const m = mark[it.state]; return (
        <Card key={it.key}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ fontWeight: '700', fontSize: 16 }}>{it.label}</Text><Pill text={m[2]} tone={it.state === 'done' ? 'ok' : it.state === 'fix' ? 'bad' : 'warn'} /></View>
          {!!it.note && <Text style={{ color: colors.error, marginTop: 6 }}>{it.note}</Text>}
          {it.state !== 'done' && <View style={{ marginTop: 10 }}><Button title={it.state === 'todo' ? 'Upload' : 'Upload again'} kind="ghost" icon="cloud-upload-outline" onPress={() => toast('Document upload opens in the next module (secure file storage).')} /></View>}</Card>); })}
    </Screen>);
}

// ---------------- Shells ----------------
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'], Requests: ['notifications', 'notifications-outline'], Trips: ['car-sport', 'car-sport-outline'], Earnings: ['wallet', 'wallet-outline'], Profile: ['person', 'person-outline'], Documents: ['document-text', 'document-text-outline'],
};
const opts = ({ route }: { route: { name: string } }) => ({
  headerShown: false, tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const }, tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
  tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />,
});

function VerifiedTabs() {
  return (<Tab.Navigator initialRouteName="Home" screenOptions={opts}>
    <Tab.Screen name="Home" component={Home} /><Tab.Screen name="Requests" component={Requests} /><Tab.Screen name="Trips" component={Trips} />
    <Tab.Screen name="Earnings" component={Earnings} /><Tab.Screen name="Profile" component={Profile} /></Tab.Navigator>);
}
function UnverifiedTabs() {
  return (<Tab.Navigator initialRouteName="Home" screenOptions={opts}>
    <Tab.Screen name="Home" component={VerificationHome} /><Tab.Screen name="Documents" component={Documents} /><Tab.Screen name="Trips" component={Trips} /><Tab.Screen name="Profile" component={Profile} /></Tab.Navigator>);
}

/** Driver shell for an approved driver. Persistent tabs: Home, Requests, Trips, Earnings, Profile. */
export function DriverApp() {
  return (<Root.Navigator screenOptions={{ headerShown: false }}><Root.Screen name="Tabs" component={VerifiedTabs} /><Root.Screen name="Documents" component={Documents} /></Root.Navigator>);
}
/** Driver shell before approval. Ride features are not reachable. Tabs: Home, Documents, Trips, Profile. */
export function DriverVerificationApp() {
  return (<Root.Navigator screenOptions={{ headerShown: false }}><Root.Screen name="Tabs" component={UnverifiedTabs} /></Root.Navigator>);
}
export const driverLinking = {
  prefixes: ['rrcabsdriver://'],
  config: { screens: { Tabs: { path: 'driver', screens: { Home: 'home', Requests: 'requests', Trips: 'trips', Earnings: 'earnings', Documents: 'documents', Profile: 'profile' } }, Documents: 'driver/documents' } },
};
