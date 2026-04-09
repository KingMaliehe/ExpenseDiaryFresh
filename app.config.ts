import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Expense Diary SA',
  slug: 'expense-diary-sa',
  owner: 'kingmaliehe',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0d1117',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.expensediarysa.app',
    buildNumber: '1',
    infoPlist: {
      NSUserNotificationUsageDescription:
        'We send budget alerts when you are close to your spending limits.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0d1117',
    },
    package: 'com.expensediarysa.app',
    versionCode: 1,
    permissions: ['RECEIVE_BOOT_COMPLETED', 'VIBRATE'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#d4a843',
      },
    ],
  ],
 extra: {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  eas: {
    projectId: '2824dab2-30bc-4a90-9c72-b6e60f7b4bf8',
  },
},
  scheme: 'expensediarysa',
});
