import { ReactNode, useEffect, useRef, useState, createContext, useContext, useCallback } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

export function Screen({ children, scroll = true, onRefresh, refreshing = false, pad = true, bg = colors.bg }: { children: ReactNode; scroll?: boolean; onRefresh?: () => void; refreshing?: boolean; pad?: boolean; bg?: string }) {
  const insets = useSafeAreaInsets();
  const body = { padding: pad ? space.lg : 0, paddingTop: (pad ? space.lg : 0) + insets.top, paddingBottom: space.xl };
  if (!scroll) return <View style={{ flex: 1, backgroundColor: bg, ...body }}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg }} contentContainerStyle={body} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.orange} /> : undefined}>
      {children}
    </ScrollView>
  );
}

export const H1 = ({ children, color = colors.text }: { children: ReactNode; color?: string }) => <Text accessibilityRole="header" style={{ fontSize: font.h1, fontWeight: '800', color }}>{children}</Text>;
export const H2 = ({ children, color = colors.text }: { children: ReactNode; color?: string }) => <Text accessibilityRole="header" style={{ fontSize: font.h2, fontWeight: '700', color }}>{children}</Text>;
export const Body = ({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) => <Text style={[{ fontSize: font.body, color: muted ? colors.muted : colors.text }, style]}>{children}</Text>;

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  const s = [styles.card, style];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={s}>{children}</Pressable> : <View style={s}>{children}</View>;
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, icon }: { title: string; onPress: () => void; kind?: 'primary' | 'navy' | 'ghost' | 'danger'; loading?: boolean; disabled?: boolean; icon?: IconName }) {
  const bg = kind === 'primary' ? colors.orange : kind === 'navy' ? colors.navy : kind === 'danger' ? colors.errorSoft : colors.white;
  const fg = kind === 'primary' ? colors.text : kind === 'navy' ? colors.white : kind === 'danger' ? colors.error : colors.text;
  const off = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }} disabled={off} onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1, borderWidth: kind === 'ghost' ? 1.5 : 0, borderColor: colors.line }]}>
      {loading ? <ActivityIndicator color={fg} /> : <>{icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 8 }} />}<Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{title}</Text></>}
    </Pressable>
  );
}

export function Field({ label, error, ...p }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ fontSize: font.small, fontWeight: '600', color: colors.muted, marginBottom: 4 }}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor="#9CA3AF" {...p}
        style={[styles.input, error ? { borderColor: colors.error } : null, p.style]} />
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: font.small, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

export function Pill({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
  const m = { neutral: [colors.navySoft, colors.navy], ok: [colors.successSoft, '#14793A'], warn: [colors.orangeSoft, '#8A4B00'], bad: [colors.errorSoft, '#B42318'] }[tone];
  return <View style={{ backgroundColor: m[0], paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' }}><Text style={{ color: m[1], fontSize: 12, fontWeight: '700' }}>{text}</Text></View>;
}

export function EmptyState({ icon = 'car-outline', title, text, action }: { icon?: IconName; title: string; text?: string; action?: { title: string; onPress: () => void } }) {
  return (
    <View style={{ alignItems: 'center', padding: space.xl }}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.navy} /></View>
      <Text style={{ fontSize: font.h3, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {!!text && <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 4, marginBottom: space.lg }}>{text}</Text>}
      {action && <View style={{ alignSelf: 'stretch' }}><Button title={action.title} onPress={action.onPress} /></View>}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ alignItems: 'center', padding: space.xl }}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.error} />
      <Text style={{ color: colors.text, textAlign: 'center', marginVertical: space.md }}>{message}</Text>
      {onRetry && <Button title="Try again" kind="ghost" onPress={onRetry} />}
    </View>
  );
}

export function Skeleton({ height = 18, width = '100%' as number | `${number}%`, style }: { height?: number; width?: number | `${number}%`; style?: ViewStyle }) {
  const o = useRef(new Animated.Value(0.4)).current;
  useEffect(() => { const a = Animated.loop(Animated.sequence([Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true })])); a.start(); return () => a.stop(); }, [o]);
  return <Animated.View accessibilityLabel="Loading" style={[{ height, width, borderRadius: 8, backgroundColor: '#E5E9F0', opacity: o, marginVertical: 6 }, style]} />;
}
export const LoadingBlock = () => <View style={{ padding: space.lg }}><Skeleton height={22} width="50%" /><Skeleton height={80} /><Skeleton height={80} /></View>;

export function Segmented({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.navySoft, borderRadius: 12, padding: 4, marginBottom: space.lg }}>
      {options.map((o) => (
        <Pressable key={o} accessibilityRole="tab" accessibilityState={{ selected: o === value }} onPress={() => onChange(o)}
          style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: o === value ? colors.white : 'transparent' }}>
          <Text style={{ fontWeight: '700', fontSize: 13, color: o === value ? colors.navy : colors.muted }}>{o}</Text>
        </Pressable>))}
    </View>
  );
}

export function Row({ icon, title, value, onPress, danger }: { icon: IconName; title: string; value?: string; onPress?: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <Ionicons name={icon} size={22} color={danger ? colors.error : colors.navy} />
      <Text style={{ flex: 1, marginLeft: 14, fontSize: font.body, color: danger ? colors.error : colors.text }}>{title}</Text>
      {!!value && <Text style={{ color: colors.muted, marginRight: 6 }}>{value}</Text>}
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

export function Avatar({ name, size = 44 }: { name?: string | null; size?: number }) {
  const t = (name ?? '?').trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';
  return <View accessibilityLabel="Profile photo" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.white, fontWeight: '800', fontSize: size * 0.38 }}>{t}</Text></View>;
}

/** Stylised map area. The live map (Google Maps) is added in the Maps module. */
export function MapArea({ height = 240, children }: { height?: number; children?: ReactNode }) {
  return (
    <View accessibilityLabel="Map area" style={{ height, backgroundColor: '#DDE7F0', overflow: 'hidden' }}>
      {[0.2, 0.45, 0.7].map((t) => <View key={t} style={{ position: 'absolute', left: 0, right: 0, top: `${t * 100}%`, height: 10, backgroundColor: '#EEF3F8' }} />)}
      {[0.15, 0.5, 0.8].map((l) => <View key={l} style={{ position: 'absolute', top: 0, bottom: 0, left: `${l * 100}%`, width: 10, backgroundColor: '#EEF3F8' }} />)}
      <View style={{ position: 'absolute', left: '22%', top: '55%' }}><Ionicons name="location" size={30} color={colors.success} /></View>
      <View style={{ position: 'absolute', left: '62%', top: '26%' }}><Ionicons name="flag" size={28} color={colors.orange} /></View>
      <View style={{ position: 'absolute', right: 10, bottom: 8, backgroundColor: 'rgba(255,255,255,.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 11, color: colors.muted }}>Live map arrives with the Maps module</Text></View>
      {children}
    </View>
  );
}

export function Confirm({ visible, title, text, confirmText, danger, onConfirm, onCancel }: { visible: boolean; title: string; text: string; confirmText: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <View style={styles.scrim}><View style={styles.dialog}>
        <Text style={{ fontSize: font.h2, fontWeight: '700', marginBottom: 6 }}>{title}</Text>
        <Text style={{ color: colors.muted, marginBottom: space.lg }}>{text}</Text>
        <View style={{ gap: 8 }}><Button title={confirmText} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} /><Button title="Cancel" kind="ghost" onPress={onCancel} /></View>
      </View></View>
    </Modal>
  );
}

// ---- Toast (short message at the top) ----
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'bad') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; tone: 'ok' | 'bad' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((msg: string, tone: 'ok' | 'bad' = 'ok') => { setT({ msg, tone }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setT(null), 3200); }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, backgroundColor: t.tone === 'ok' ? colors.navy : colors.error, padding: 14, borderRadius: 14, borderLeftWidth: 5, borderLeftColor: colors.orange }}>
        <Text style={{ color: colors.white, fontWeight: '600' }}>{t.msg}</Text></View>}
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.md, padding: space.lg, borderWidth: 1, borderColor: colors.line, marginBottom: space.md },
  btn: { minHeight: 52, borderRadius: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1.5, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, backgroundColor: colors.white, color: colors.text },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.navySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line, minHeight: 52 },
  scrim: { flex: 1, backgroundColor: 'rgba(11,31,51,.55)', justifyContent: 'center', padding: space.xl },
  dialog: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.xl },
});
