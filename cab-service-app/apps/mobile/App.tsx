import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import { ProfileProvider } from './src/navigation/ProfileProvider';
import RootNavigator from './src/navigation/RootNavigator';
import { ToastProvider } from './src/components/ui';

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <ProfileProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ProfileProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
