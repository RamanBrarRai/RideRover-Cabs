import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Phones: encrypted storage (Keychain / Keystore). Web browser preview: localStorage.
export const storage = {
  async get(key: string): Promise<string | null> {
    try { return Platform.OS === 'web' ? localStorage.getItem(key) : await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async set(key: string, value: string) {
    try { if (Platform.OS === 'web') localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value); } catch { /* ignore */ }
  },
  async remove(key: string) {
    try { if (Platform.OS === 'web') localStorage.removeItem(key); else await SecureStore.deleteItemAsync(key); } catch { /* ignore */ }
  },
};
