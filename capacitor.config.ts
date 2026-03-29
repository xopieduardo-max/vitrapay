import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.vitrapay',
  appName: 'VitraPay',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*.vitrapay.com.br', '*.supabase.co', '*.asaas.com'],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
