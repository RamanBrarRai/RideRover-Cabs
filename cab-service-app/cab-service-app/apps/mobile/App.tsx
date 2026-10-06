import { Platform, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { ProfileProvider } from './src/navigation/ProfileProvider';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/ui';
import { APP_ROLE, DEMO } from './src/config';

export default function App() {
  const app = (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <ProfileProvider>
            <StatusBar style="dark" />
            {DEMO && (
              <View accessibilityRole="alert" style={{ backgroundColor: '#FF8A00', paddingVertical: 4, paddingHorizontal: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#111827', textAlign: 'center' }}>
                  DEMO with sample data, not connected to a server. Login code: 123456{APP_ROLE === 'DRIVER' ? '  |  Drivers: 9000000002 (approved), 9000000003 (waiting)' : '  |  Try 9000000001'}
                </Text>
              </View>)}
            <View style={{ flex: 1 }}><RootNavigator /></View>
          </ProfileProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
  // On a computer browser, show the app in a phone-sized column so it looks like it does on a phone.
  if (Platform.OS !== 'web') return app;
  return (
    <View style={{ flex: 1, backgroundColor: '#E9EEF5', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: '#F7F9FC', overflow: 'hidden', borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#D5DCE6' }}>{app}</View>
    </View>
  );
}
