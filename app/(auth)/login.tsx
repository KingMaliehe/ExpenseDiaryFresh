// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/(tabs)/dashboard');
    } catch {
      // Error is shown via store state
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoArea}>
          <Text style={styles.logoTitle}>Expense Diary SA</Text>
          <Text style={styles.logoSub}>Personal Finance, Simplified</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSub}>Sign in to your account</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={clearError}>
                <Text style={styles.errorDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.subtle}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.subtle}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotWrap}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Create account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },

  logoArea: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoTitle: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  logoSub: { fontSize: Typography.sm, color: Colors.muted, marginTop: 4 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  cardTitle: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: Typography.base, color: Colors.muted, marginBottom: Spacing.xl },

  errorBox: {
    backgroundColor: 'rgba(248,81,73,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.3)',
    borderRadius: Radius.sm,
    padding: Spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  errorText: { color: Colors.red, fontSize: Typography.sm, flex: 1 },
  errorDismiss: { color: Colors.red, fontSize: Typography.md, marginLeft: Spacing.sm },

  fieldGroup: { marginBottom: Spacing.lg },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
  },

  forgotWrap: { alignSelf: 'flex-end', marginBottom: Spacing.xl },
  forgotText: { fontSize: Typography.sm, color: Colors.accent },

  btn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.bg },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { fontSize: Typography.base, color: Colors.muted },
  footerLink: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },
});
