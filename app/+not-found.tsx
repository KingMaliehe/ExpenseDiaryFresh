// app/+not-found.tsx
// Catches any deep link or navigation that doesn't match a known route
// (e.g. a bare `expensediarysa:///` link from an email) and bounces the user
// back to the app's index screen instead of showing the default
// "Unmatched Route" page.
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors } from '../src/theme';

export default function NotFoundScreen() {
  useEffect(() => {
    // Replace so the unmatched route can't be returned to via the back button.
    router.replace('/');
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.accent} size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
});
