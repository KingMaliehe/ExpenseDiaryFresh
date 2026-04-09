// app/(tabs)/profile.tsx
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, TextInput, Alert, Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

export default function ProfileScreen() {
  const { profile, user, updateProfile, signOut, loading } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(profile?.monthly_income?.toString() ?? '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleSave = async () => {
    await updateProfile({
      full_name: fullName.trim(),
      monthly_income: parseFloat(monthlyIncome) || 0,
    });
    setEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        }
      },
    ]);
  };

  const initials = (profile?.full_name ?? user?.email ?? '??')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? 'User'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Edit profile */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Personal info</Text>
          <TouchableOpacity onPress={() => editing ? handleSave() : setEditing(true)}>
            <Text style={styles.editBtn}>{editing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full name</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={fullName} onChangeText={setFullName} placeholderTextColor={Colors.subtle} />
            ) : (
              <Text style={styles.fieldValue}>{profile?.full_name ?? '—'}</Text>
            )}
          </View>
          <View style={[styles.field, styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{user?.email}</Text>
          </View>
          <View style={[styles.field, styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>Monthly income (R)</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={monthlyIncome} onChangeText={setMonthlyIncome} keyboardType="decimal-pad" placeholderTextColor={Colors.subtle} />
            ) : (
              <Text style={styles.fieldValue}>
                {profile?.monthly_income ? `R ${profile.monthly_income.toLocaleString('en-ZA')}` : '—'}
              </Text>
            )}
          </View>
          <View style={[styles.field, styles.fieldBorder]}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <Text style={styles.fieldValue}>ZAR (South African Rand)</Text>
          </View>
        </View>
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={[styles.field, styles.fieldRow]}>
            <Text style={styles.fieldLabel}>Budget alerts</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: Colors.surface3, true: Colors.accent }}
              thumbColor={Colors.text}
            />
          </View>
        </View>
      </View>

      {/* Account actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.actionText}>Change password</Text>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Expense Diary SA v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, paddingBottom: 60 },
  avatarSection: { alignItems: 'center', marginBottom: Spacing.xxxl },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent + '33', borderWidth: 2, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.accent },
  name: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text },
  email: { fontSize: Typography.sm, color: Colors.muted, marginTop: 4 },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  editBtn: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  field: { padding: Spacing.lg },
  fieldBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  fieldRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: Typography.xs, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  fieldValue: { fontSize: Typography.base, color: Colors.text, fontWeight: Typography.medium },
  fieldInput: { fontSize: Typography.base, color: Colors.text, backgroundColor: Colors.surface2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.accent, padding: 8 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg },
  actionText: { fontSize: Typography.base, color: Colors.text },
  actionChevron: { fontSize: 20, color: Colors.muted },
  signOutBtn: { backgroundColor: 'rgba(248,81,73,0.1)', borderWidth: 1, borderColor: 'rgba(248,81,73,0.3)', borderRadius: Radius.sm, padding: Spacing.lg, alignItems: 'center', marginBottom: Spacing.lg },
  signOutText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.red },
  version: { textAlign: 'center', fontSize: Typography.xs, color: Colors.subtle },
});
