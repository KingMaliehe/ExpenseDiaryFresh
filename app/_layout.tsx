// app/_layout.tsx
// Rewritten for the custom backend. On launch:
//   1. Bootstrap the session from SecureStore (validate against /auth/me)
//   2. Wire onSessionChange so a refresh failure clears the local store
//      (forces a bounce to login next render)
//   3. Flush any queued offline writes
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { bootstrapSession, clearLocalSession } from '../src/store/authStore';
import { onSessionChange } from '../src/services/apiClient';
import { syncOfflineQueue } from '../src/services/offlineSync';
import { Colors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    let mounted = true;

    (async () => {
      await bootstrapSession();
      if (!mounted) return;
      SplashScreen.hideAsync();
      // Flush anything that didn't make it to the server while offline.
      syncOfflineQueue().catch(() => {});
    })();

    // If the API client fails to refresh, it calls notify(null) — we react
    // by clearing the local session so the next render bounces to /login.
    const unsubscribe = onSessionChange((user) => {
      if (!user) clearLocalSession();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
        <StatusBar style="light" backgroundColor={Colors.bg} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
