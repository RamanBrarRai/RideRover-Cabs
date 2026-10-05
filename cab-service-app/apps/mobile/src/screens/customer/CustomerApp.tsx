import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { api, ApiError } from '../../api';
import { useAuth } from '../../auth/AuthContext';
import { useProfile } from '../../navigation/ProfileProvider';
import { Avatar, Body, Button, Card, Confirm, EmptyState, Field, H1, H2, MapArea, Pill, Row, Screen, Segmented, useToast } from '../../components/ui';
import { colors, space } from '../../theme';
import { firstName, greeting, isValidEmail, toDateString, validateWhen } from '../../validate';

export type RideMode = 'PERSONAL' | 'SHARED';
type Stack = { Tabs: undefined; BookRide: { mode: RideMode; pickup: string; destination: string } };
const Tab = createBottomTabNavigator();
const Root = createNativeStackNavigator<Stack>();

// ---------------- Home ----------------
function Home() {
  const nav = useNavigation<any>();
  const { profile } = useProfile();
  const [pickup, setPickup] = useState('Current location');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState<RideMode>('PERSONAL');
  const [err, setErr] = useState<string | null>(null);

  function book() {
    if (destination.trim().length < 2) return setErr('Where are you going? Enter a destination.');
    if (pickup.trim().length < 2) return setErr('Enter a pickup place.');
    setErr(null);
    nav.navigate('BookRide', { mode, pickup: pickup.trim(), destination: destination.trim() });
  }
  const Option = ({ m, icon, title, sub }: { m: RideMode; icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }) => (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === m }} onPress={() => setMode(m)}
      style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 2, borderColor: mode === m ? colors.orange : colors.line, backgroundColor: mode === m ? colors.orangeSoft : colors.white, marginBottom: 10 }}>
      <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.navySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={24} color={colors.navy} /></View>
      <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>{title}</Text><Text style={{ color: colors.muted }}>{sub}</Text></View>
      <Ionicons name={mode === m ? 'radio-button-on' : 'radio-button-off'} size={22} color={mode === m ? colors.orange : colors.muted} />
    </Pressable>);
  return (
    <Screen pad={false}>
      <View>
        <MapArea height={250} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: space.lg, paddingTop: space.lg + 36, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 13 }}>{greeting()}</Text><Text style={{ fontSize: 20, fontWeight: '800', color: colors.navy }}>{firstName(profile?.fullName)}</Text></View>
          <Pressable accessibilityLabel="Notifications" onPress={() => nav.navigate('Activity')} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Ionicons name="notifications-outline" size={22} color={colors.navy} /></Pressable>
          <Pressable accessibilityLabel="Profile" onPress={() => nav.navigate('Profile')}><Avatar name={profile?.fullName} /></Pressable>
        </View>
      </View>
      <View style={{ marginTop: -24, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.lg }}>
        <H2>Where are you going?</H2>
        <View style={{ marginTop: 12 }}>
          <Field label="Pickup" value={pickup} onChangeText={setPickup} placeholder="Current location" />
          <Field label="Destination" value={destination} onChangeText={(t) => { setDestination(t); setErr(null); }} placeholder="Enter destination city or place" error={err} />
        </View>
        <H2>Choose your ride</H2>
        <View style={{ marginTop: 10 }}>
          <Option m="PERSONAL" icon="car-sport" title="Personal Cab" sub="Private ride, just for you" />
          <Option m="SHARED" icon="people" title="Share Cab" sub="Save money by sharing the trip" />
        </View>
        <Button title="Book ride" onPress={book} />
        <Card style={{ marginTop: space.lg }}><Text style={{ fontWeight: '700', color: colors.text }}>Active ride</Text><Body muted>You have no active ride.</Body></Card>
      </View>
    </Screen>
  );
}

// ---------------- Book flow (full screen, tabs hidden) ----------------
function BookRide({ route, navigation }: NativeStackScreenProps<Stack, 'BookRide'>) {
  const { mode, pickup, destination } = route.params;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [date, setDate] = useState(toDateString(tomorrow));
  const [time, setTime] = useState('08:00');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}><Ionicons name="chevron-back" size={22} color={colors.navy} /><Text style={{ color: colors.navy, fontWeight: '700' }}>Back</Text></Pressable>
      <H1>{mode === 'PERSONAL' ? 'Personal Cab' : 'Share Cab'}</H1>
      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="location" size={18} color={colors.success} /><Text style={{ marginLeft: 8, fontWeight: '600' }}>{pickup}</Text></View>
        <View style={{ height: 14, borderLeftWidth: 2, borderColor: colors.line, marginLeft: 8 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="flag" size={18} color={colors.orange} /><Text style={{ marginLeft: 8, fontWeight: '600' }}>{destination}</Text></View>
      </Card>
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={(t) => { setDate(t); setOk(false); }} keyboardType="numbers-and-punctuation" />
      <Field label="Time (24-hour, HH:MM)" value={time} onChangeText={(t) => { setTime(t); setOk(false); }} keyboardType="numbers-and-punctuation" error={err} />
      <Button title={mode === 'PERSONAL' ? 'See fare' : 'Search shared rides'} onPress={() => { const e = validateWhen(date, time); setErr(e); setOk(!e); }} />
      {ok && (
        <Card style={{ marginTop: space.lg, backgroundColor: colors.orangeSoft, borderColor: colors.orangeSoft }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>Trip details saved on this screen</Text>
          <Body muted style={{ marginTop: 4 }}>Fares, driver matching and payment are switched on in the next modules (pricing and maps, then booking and payments). Nothing is booked yet and you have not been charged.</Body>
          <View style={{ marginTop: 12 }}><Button title="Back to Home" kind="ghost" onPress={() => navigation.popToTop()} /></View>
        </Card>)}
    </Screen>
  );
}

// ---------------- Rides ----------------
function Rides() {
  const nav = useNavigation<any>();
  const [seg, setSeg] = useState('Upcoming');
  const text: Record<string, string> = { Upcoming: 'Your booked rides will appear here.', Completed: 'Rides you have finished will appear here.', Cancelled: 'Rides that were cancelled will appear here.' };
  return (
    <Screen><H1>Rides</H1><View style={{ height: 14 }} />
      <Segmented options={['Upcoming', 'Completed', 'Cancelled']} value={seg} onChange={setSeg} />
      <EmptyState icon="car-outline" title={`No ${seg.toLowerCase()} rides`} text={text[seg]} action={seg === 'Upcoming' ? { title: 'Book a ride', onPress: () => nav.navigate('Home') } : undefined} />
    </Screen>);
}

function Activity() {
  return (<Screen><H1>Activity</H1><View style={{ height: 14 }} />
    <EmptyState icon="receipt-outline" title="No activity yet" text="Bookings, payments, cancellations and shared-ride updates will appear here." /></Screen>);
}

function Messages() {
  return (<Screen><H1>Messages</H1><View style={{ height: 14 }} />
    <EmptyState icon="chatbubbles-outline" title="No messages" text="Once a driver accepts your ride, you can chat with them here. Support messages show up here too." /></Screen>);
}

// ---------------- Profile ----------------
function Profile() {
  const { profile, setProfile } = useProfile();
  const { signOut } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.fullName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [askLogout, setAskLogout] = useState(false);
  const later = (what: string) => () => toast(`${what} is coming in a later update.`);

  async function save() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (email && !isValidEmail(email)) e.email = 'That email does not look right.';
    setErr(e); if (Object.keys(e).length) return;
    setBusy(true);
    try { const r = await api<{ profile: any }>('/customers/profile', { method: 'PUT', body: JSON.stringify({ fullName: name.trim(), ...(email ? { email } : {}) }) }); setProfile(r.profile); setEditing(false); toast('Profile saved.'); }
    catch (x) { setErr({ top: x instanceof ApiError ? x.message : 'Something went wrong.' }); } finally { setBusy(false); }
  }
  const kyc = profile?.kycStatus ?? 'NOT_STARTED';
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Avatar name={profile?.fullName} size={84} />
        <Text style={{ fontSize: 22, fontWeight: '800', marginTop: 10, color: colors.text }}>{profile?.fullName}</Text>
        <Text style={{ color: colors.muted }}>+91 {profile?.phone}</Text>
        <View style={{ marginTop: 8 }}><Pill text={kyc === 'VERIFIED' ? 'Identity verified' : 'Phone verified'} tone={kyc === 'VERIFIED' ? 'ok' : 'warn'} /></View>
      </View>
      {editing ? (
        <Card>
          {!!err.top && <Text accessibilityRole="alert" style={{ color: colors.error, marginBottom: 8 }}>{err.top}</Text>}
          <Field label="Full name" value={name} onChangeText={setName} error={err.name} />
          <Field label="Email" value={email} onChangeText={setEmail} error={err.email} keyboardType="email-address" autoCapitalize="none" />
          <View style={{ gap: 8 }}><Button title="Save" onPress={save} loading={busy} /><Button title="Cancel" kind="ghost" onPress={() => setEditing(false)} /></View>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          <Row icon="person-outline" title="Personal information" value={profile?.email ?? 'Add email'} onPress={() => { setName(profile?.fullName ?? ''); setEmail(profile?.email ?? ''); setEditing(true); }} />
          <Row icon="card-outline" title="Payment methods" onPress={later('Payment methods')} />
          <Row icon="bookmark-outline" title="Saved places" onPress={later('Saved places')} />
          <Row icon="notifications-outline" title="Notification settings" onPress={later('Notification settings')} />
          <Row icon="help-circle-outline" title="Help & Support" onPress={later('Help & Support')} />
          <Row icon="document-text-outline" title="Terms" onPress={later('Terms')} />
          <Row icon="lock-closed-outline" title="Privacy" onPress={later('Privacy')} />
        </Card>)}
      <View style={{ marginTop: 6 }}><Button title="Log out" kind="danger" icon="log-out-outline" onPress={() => setAskLogout(true)} /></View>
      <Confirm visible={askLogout} title="Log out?" text="You will need a new code to log in again." confirmText="Log out" danger onConfirm={() => { setAskLogout(false); signOut(); }} onCancel={() => setAskLogout(false)} />
    </Screen>);
}

// ---------------- Shell ----------------
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'], Rides: ['car-sport', 'car-sport-outline'], Activity: ['receipt', 'receipt-outline'], Messages: ['chatbubbles', 'chatbubbles-outline'], Profile: ['person', 'person-outline'],
};
function Tabs() {
  return (
    <Tab.Navigator initialRouteName="Home" screenOptions={({ route }) => ({
      headerShown: false, tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '700' }, tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
      tabBarIcon: ({ focused, color, size }) => <Ionicons name={ICONS[route.name][focused ? 0 : 1]} size={size} color={color} />,
    })}>
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Rides" component={Rides} />
      <Tab.Screen name="Activity" component={Activity} />
      <Tab.Screen name="Messages" component={Messages} />
      <Tab.Screen name="Profile" component={Profile} />
    </Tab.Navigator>
  );
}

/** The customer app shell. It stays mounted; tabs stay visible; the booking flow opens full screen on top. */
export default function CustomerApp() {
  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      <Root.Screen name="Tabs" component={Tabs} />
      <Root.Screen name="BookRide" component={BookRide} />
    </Root.Navigator>
  );
}
export const customerLinking = {
  prefixes: ['rrcabs://'],
  config: { screens: { Tabs: { path: 'customer', screens: { Home: 'home', Rides: 'rides', Activity: 'activity', Messages: 'messages', Profile: 'profile' } }, BookRide: 'customer/book' } },
};
