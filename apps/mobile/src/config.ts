export type AppRole = 'CUSTOMER' | 'DRIVER';
// These must be written as process.env.EXPO_PUBLIC_* so Expo can inline them at build time.
export const APP_ROLE: AppRole = process.env.EXPO_PUBLIC_APP_ROLE === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
export const API_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
// Demo mode: the app talks to a built-in sample server instead of the real API. For previews only.
export const DEMO: boolean = process.env.EXPO_PUBLIC_DEMO === '1';
