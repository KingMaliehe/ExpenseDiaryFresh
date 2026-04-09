// app/(auth)/register.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const { signUp, loading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    setLocalError('');
    clearError();
    if (!fullName || !email || !password) { setLocalError('All fields are required.'); return; }
    if (password.length < 8) { setLocalError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setLocalError('Passwords do not match.'); return; }
    try {
      await signUp(email.trim().toLowerCase(), password, fullName.trim());
      router.replace('/(tabs)/dashboard');
    } catch { /* error in store */ }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Text style={styles.logoTitle}>Expense Diary SA</Text>
          <Text style={styles.logoSub}>Start your financial journey</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create account</Text>
          <Text style={styles.cardSub}>Free forever, no credit card needed</Text>

          {displayError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          ) : null}

          {[
            { label: 'Full name', value: fullName, setter: setFullName, placeholder: 'Sipho Dlamini', type: 'default' as const },
            { label: 'Email address', value: email, setter: setEmail, placeholder: 'sipho@example.com', type: 'email-address' as const },
            { label: 'Password', value: password, setter: setPassword, placeholder: '••••••••', type: 'default' as const, secure: true },
            { label: 'Confirm password', value: confirm, setter: setConfirm, placeholder: '••••••••', type: 'default' as const, secure: true },
          ].map((f) => (
            <View key={f.label} style={styles.fieldGroup}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={f.value}
                onChangeText={f.setter}
                placeholder={f.placeholder}
                placeholderTextColor={Colors.subtle}
                keyboardType={f.type}
                autoCapitalize={f.type === 'email-address' ? 'none' : 'words'}
                secureTextEntry={f.secure}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Sign in</Text>
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
  logoTitle: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.accent, letterSpacing: 0.5 },
  logoSub: { fontSize: Typography.sm, color: Colors.muted, marginTop: 4 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl },
  cardTitle: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text, marginBottom: 4 },
  cardSub: { fontSize: Typography.base, color: Colors.muted, marginBottom: Spacing.xl },
  errorBox: { backgroundColor: 'rgba(248,81,73,0.1)', borderWidth: 1, borderColor: 'rgba(248,81,73,0.3)', borderRadius: Radius.sm, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { color: Colors.red, fontSize: Typography.sm },
  fieldGroup: { marginBottom: Spacing.lg },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text },
  btn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.bg },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  footerText: { fontSize: Typography.base, color: Colors.muted },
  footerLink: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },
});
