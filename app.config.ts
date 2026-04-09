import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Expense Diary SA",
  slug: "expense-diary-sa",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0d1117",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.expensediarysa.app",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0d1117",
    },
    package: "com.expensediarysa.app",
  },
  plugins: ["expo-router", "expo-secure-store"],
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: "2824dab2-30bc-4a90-9c72-b6e60f7b4bf8",
    },
  },
  scheme: "expensediarysa",
  owner: "kingmaliehe",
});
