import { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_ROLE } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { Button } from '../../components/ui';
import { colors } from '../../theme';

const CUSTOMER = [
  { icon: 'car-sport', title: 'Outstation rides, sorted', text: 'Book a full cab between cities, or share one with travellers going your way.' },
  { icon: 'people', title: 'Share and save', text: 'We match by route, not just by city. A ride that starts in Chandigarh can still pick you up in Mohali.' },
  { icon: 'shield-checkmark', title: 'Verified drivers only', text: 'Every driver is document-checked before taking a single ride.' },
] as const;
const DRIVER = [
  { icon: 'cash', title: 'Earn on long routes', text: 'Take outstation trips and shared rides that fit your route and your schedule.' },
  { icon: 'document-text', title: 'Quick verification', text: 'Add your licence and vehicle documents once. We check them and tell you the moment you are approved.' },
  { icon: 'toggle', title: 'You choose when to drive', text: 'Go online when you are ready. Go offline when you are done.' },
] as const;

export default function Onboarding() {
  const { finishOnboarding } = useAuth();
  const slides = APP_ROLE === 'DRIVER' ? DRIVER : CUSTOMER;
  const [i, setI] = useState(0);
  const s = slides[i];
  const insets = useSafeAreaInsets();
  const last = i === slides.length - 1;
  return (
    <View style={{ flex: 1, backgroundColor: colors.navy, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <Text style={{ color: colors.white, fontSize: 20, fontWeight: '800' }}>RR <Text style={{ color: colors.orange }}>Cabs</Text>{APP_ROLE === 'DRIVER' ? '  Driver' : ''}</Text>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,138,0,.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
          <Ionicons name={s.icon} size={44} color={colors.orange} /></View>
        <Text accessibilityRole="header" style={{ color: colors.white, fontSize: 30, fontWeight: '800', marginBottom: 10 }}>{s.title}</Text>
        <Text style={{ color: '#C9D5E4', fontSize: 17, lineHeight: 25 }}>{s.text}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
        {slides.map((_, k) => <View key={k} style={{ height: 6, flex: k === i ? 2 : 1, borderRadius: 3, backgroundColor: k <= i ? colors.orange : 'rgba(255,255,255,.25)' }} />)}
      </View>
      <Button title={last ? 'Get started' : 'Next'} onPress={() => (last ? finishOnboarding() : setI(i + 1))} />
      {!last && <View style={{ marginTop: 8 }}><Button title="Skip" kind="navy" onPress={finishOnboarding} /></View>}
    </View>
  );
}
