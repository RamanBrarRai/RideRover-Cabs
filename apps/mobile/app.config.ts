import type { ExpoConfig } from 'expo/config';

// One codebase, two apps. EXPO_PUBLIC_APP_ROLE=CUSTOMER or DRIVER decides which app is built.
const driver = process.env.EXPO_PUBLIC_APP_ROLE === 'DRIVER';

const config: ExpoConfig = {
  name: driver ? 'RR Cabs Driver' : 'RR Cabs',
  slug: driver ? 'rr-cabs-driver' : 'rr-cabs',
  scheme: driver ? 'rrcabsdriver' : 'rrcabs',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: driver ? 'com.rrcabs.driver' : 'com.rrcabs.customer' },
  android: {
    package: driver ? 'com.rrcabs.driver' : 'com.rrcabs.customer',
    adaptiveIcon: {
      backgroundColor: '#0B1F33',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png', bundler: 'metro' },
  plugins: ['expo-secure-store'],
  // Only for hosting a web preview in a sub-folder (for example GitHub Pages).
  ...(process.env.EXPO_PUBLIC_BASE_URL ? { experiments: { baseUrl: process.env.EXPO_PUBLIC_BASE_URL } } : {}),
};
export default config;
