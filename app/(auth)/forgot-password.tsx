// app/(auth)/forgot-password.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const { resetPassword, loading } = useAuthStore();

  const handleReset = async () => {
    if (!email) { Alert.alert('Error', 'Please enter your email address.'); return; }
    try {
      await resetPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        {sent ? (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>📬</Text>
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              We sent a password reset link to {email}. Check your inbox and follow the instructions.
            </Text>
            <TouchableOpacity style={styles.btn} onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.btnText}>Back to login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>Enter your email and we'll send you a reset link.</Text>

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
              />
            </View>

            <TouchableOpacity style={[styles.btn, loading && { opacity: 0.6 }]} onPress={handleReset} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send reset link'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 60, left: Spacing.xl },
  backText: { fontSize: Typography.md, color: Colors.accent },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl },
  title: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text, marginBottom: 8 },
  subtitle: { fontSize: Typography.base, color: Colors.muted, marginBottom: Spacing.xl },
  fieldGroup: { marginBottom: Spacing.xl },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text },
  btn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, padding: Spacing.lg, alignItems: 'center' },
  btnText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.bg },
  successCard: { alignItems: 'center', padding: Spacing.xl },
  successIcon: { fontSize: 56, marginBottom: Spacing.lg },
  successTitle: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text, marginBottom: 8 },
  successText: { fontSize: Typography.base, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.xxxl },
});
