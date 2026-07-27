// Cross-platform confirmation dialog.
//
// React Native's Alert.alert renders buttons on iOS/Android, but on web
// (react-native-web) the button callbacks don't fire — so anything gated behind
// a confirm (sign out, delete) silently does nothing in the browser. This
// helper uses the native window.confirm on web and Alert on native, returning a
// promise that resolves true when the user confirms.
import { Alert, Platform } from 'react-native';

export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = 'OK',
  destructive = false,
): Promise<boolean> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    return Promise.resolve(
      typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : false,
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
