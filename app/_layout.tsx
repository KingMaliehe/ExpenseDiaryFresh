// app/_layout.tsx
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/store/authStore';
import { syncOfflineQueue } from '../src/services/offlineSync';
import { Colors } from '../src/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Returns true if this URL is a password-recovery deep link.
 * Matches: "…/reset-password?…", "…/reset-password#…",
 * or any URL that contains a recovery code / token_hash.
 */
function isResetPasswordUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('/reset-password')) return true;
  if (lower.includes('type=recovery')) return true;
  if (lower.includes('token_hash=') && lower.includes('recovery')) return true;
  return false;
}

/**
 * Extract everything after "reset-password" (query + fragment) so we can
 * forward it to the route as params.
 */
function extractResetParams(url: string): string {
  const idx = url.toLowerCase().indexOf('reset-password');
  if (idx === -1) return '';
  return url.slice(idx + 'reset-password'.length);
}

export default function RootLayout() {
  const { setSession } = useAuthStore();

  useEffect(() => {
    const goToResetPassword = (url: string) => {
      const tail = extractResetParams(url);
      // router.replace so the user can't "back" into the recovery screen
      router.replace(`/reset-password${tail}` as any);
    };

    // 1. Handle URL the app was LAUNCHED with
    Linking.getInitialURL().then((url) => {
      if (url && isResetPasswordUrl(url)) {
        goToResetPassword(url);
      }
    });

    // 2. Handle URLs that arrive while the app is already open
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      if (isResetPasswordUrl(url)) {
        goToResetPassword(url);
      }
    });

    // 3. Initial session + auth listener (existing behaviour)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      SplashScreen.hideAsync();
      if (session) syncOfflineQueue();
    });

    const {
      data: { subscription: authSub },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // If Supabase detects a recovery flow (implicit/hash-fragment case),
      // jump to the reset-password screen.
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/reset-password');
      }
    });

    return () => {
      linkSub.remove();
      authSub.unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="light" backgroundColor={Colors.bg} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reset-password" />
      </Stack>
    </GestureHandlerRootView>
  );
}
