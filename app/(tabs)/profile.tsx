// app/(tabs)/profile.tsx
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Switch,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { confirmAsync } from '../../src/lib/confirm';
import { CURRENCIES, currencyInfo, formatMoney } from '../../src/lib/currency';
import { api } from '../../src/services/apiClient';
import { useAuthStore } from '../../src/store/authStore';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';

export default function ProfileScreen() {
  const { profile, user, updateProfile, signOut } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [monthlyIncome, setMonthlyIncome] = useState(profile?.monthly_income?.toString() ?? '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [showCurrency, setShowCurrency] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const currency = currencyInfo(profile?.currency);

  const handleSave = async () => {
    await updateProfile({
      full_name: fullName.trim(),
      monthly_income: parseFloat(monthlyIncome) || 0,
    });
    setEditing(false);
  };

  const handleSelectCurrency = async (code: string) => {
    setShowCurrency(false);
    if (code !== profile?.currency) {
      await updateProfile({ currency: code });
    }
  };

  const handleSignOut = async () => {
    const ok = await confirmAsync('Sign out', 'Are you sure you want to sign out?', 'Sign out', true);
    if (!ok) return;
    await signOut();
    router.replace('/(auth)/login');
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
            <Text style={styles.fieldLabel}>Monthly income ({currency.symbol})</Text>
            {editing ? (
              <TextInput style={styles.fieldInput} value={monthlyIncome} onChangeText={setMonthlyIncome} keyboardType="decimal-pad" placeholderTextColor={Colors.subtle} />
            ) : (
              <Text style={styles.fieldValue}>
                {profile?.monthly_income ? formatMoney(profile.monthly_income, profile.currency, { decimals: false }) : '—'}
              </Text>
            )}
          </View>
          {/* Currency — tap to change */}
          <TouchableOpacity style={[styles.field, styles.fieldBorder, styles.fieldRow]} onPress={() => setShowCurrency(true)}>
            <View>
              <Text style={styles.fieldLabel}>Currency</Text>
              <Text style={styles.fieldValue}>{currency.code} ({currency.name})</Text>
            </View>
            <Text style={styles.actionChevron}>›</Text>
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.actionRow} onPress={() => setShowChangePassword(true)}>
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

      {/* Currency picker modal */}
      <Modal visible={showCurrency} transparent animationType="slide" onRequestClose={() => setShowCurrency(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select currency</Text>
              <TouchableOpacity onPress={() => setShowCurrency(false)}>
                <Text style={styles.modalCancel}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CURRENCIES.map((c) => {
                const active = c.code === currency.code;
                return (
                  <TouchableOpacity key={c.code} style={styles.currencyRow} onPress={() => handleSelectCurrency(c.code)}>
                    <Text style={styles.currencySymbol}>{c.symbol}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.currencyName}>{c.name}</Text>
                      <Text style={styles.currencyCode}>{c.code}</Text>
                    </View>
                    {active && <Text style={styles.currencyCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Change password modal */}
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Change password modal
// ---------------------------------------------------------------------------
function ChangePasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setConfirm(''); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!current || !next) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (next.length < 6) {
      Alert.alert('Weak password', 'New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Passwords don’t match', 'The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await api.auth.changePassword(current, next);
      Alert.alert('Password changed', 'Your password has been updated.');
      close();
    } catch (e: any) {
      Alert.alert('Could not change password', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={close}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change password</Text>
            <TouchableOpacity onPress={submit} disabled={saving}>
              <Text style={[styles.modalSave, saving && { opacity: 0.5 }]}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.pwLabel}>Current password</Text>
            <TextInput style={styles.pwInput} value={current} onChangeText={setCurrent} secureTextEntry placeholder="••••••••" placeholderTextColor={Colors.subtle} />
            <Text style={styles.pwLabel}>New password</Text>
            <TextInput style={styles.pwInput} value={next} onChangeText={setNext} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={Colors.subtle} />
            <Text style={styles.pwLabel}>Confirm new password</Text>
            <TextInput style={styles.pwInput} value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="Re-enter new password" placeholderTextColor={Colors.subtle} />
          </View>
        </View>
      </View>
    </Modal>
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

  // Modals (shared)
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: Colors.border, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.text },
  modalCancel: { fontSize: Typography.base, color: Colors.muted },
  modalSave: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.semibold },
  modalBody: { padding: Spacing.xl },

  // Currency picker
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  currencySymbol: { fontSize: 20, fontWeight: Typography.bold, color: Colors.accent, width: 40, textAlign: 'center' },
  currencyName: { fontSize: Typography.base, color: Colors.text, fontWeight: Typography.medium },
  currencyCode: { fontSize: Typography.xs, color: Colors.muted, marginTop: 2 },
  currencyCheck: { fontSize: Typography.lg, color: Colors.accent, fontWeight: Typography.bold },

  // Change password
  pwLabel: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: Spacing.lg },
  pwInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text },
});
