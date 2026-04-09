// app/(tabs)/add.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { supabase } from '../../src/services/supabase';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useAuthStore } from '../../src/store/authStore';
import { Category } from '../../src/types/database';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

export default function AddScreen() {
  const { user } = useAuthStore();
  const { addTransaction } = useTransactionStore();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
      .then(({ data }) => setCategories(data ?? []));
  }, [user]);

  const filteredCategories = categories.filter((c) =>
    type === 'income' ? c.name === 'Income' || c.name === 'Savings' : c.name !== 'Income'
  );

  const handleSave = async () => {
    if (!description.trim()) { Alert.alert('Error', 'Please enter a description.'); return; }
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) { Alert.alert('Error', 'Please enter a valid amount.'); return; }
    if (!selectedCategory) { Alert.alert('Error', 'Please select a category.'); return; }

    setSaving(true);
    try {
      await addTransaction({
        description: description.trim(),
        amount: parsedAmount,
        type,
        date,
        category_id: selectedCategory.id,
        notes: notes.trim() || null,
        is_recurring: false,
      });
      // Reset form
      setDescription('');
      setAmount('');
      setSelectedCategory(null);
      setNotes('');
      router.push('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>New entry</Text>
        </View>

        {/* Type toggle */}
        <View style={styles.typeToggle}>
          {(['expense', 'income'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, type === t && (t === 'expense' ? styles.typeBtnExpense : styles.typeBtnIncome)]}
              onPress={() => { setType(t); setSelectedCategory(null); }}
            >
              <Text style={[styles.typeBtnText, type === t && (t === 'expense' ? styles.typeTextExpense : styles.typeTextIncome)]}>
                {t === 'expense' ? '💸 Expense' : '💰 Income'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount — big and prominent */}
        <View style={styles.amountCard}>
          <Text style={styles.amountPrefix}>R</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={Colors.subtle}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Woolworths groceries"
            placeholderTextColor={Colors.subtle}
          />
        </View>

        {/* Category grid */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.catGrid}>
            {filteredCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catChip, selectedCategory?.id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={styles.catChipIcon}>{cat.icon}</Text>
                <Text style={[styles.catChipLabel, selectedCategory?.id === cat.id && { color: cat.color }]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.subtle}
          />
        </View>

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any extra details…"
            placeholderTextColor={Colors.subtle}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save */}
        <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save entry'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  header: { marginBottom: Spacing.xl },
  title: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  typeToggle: { flexDirection: 'row', backgroundColor: Colors.surface2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.xl },
  typeBtn: { flex: 1, padding: 12, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: 'rgba(248,81,73,0.15)' },
  typeBtnIncome: { backgroundColor: 'rgba(63,185,80,0.15)' },
  typeBtnText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.muted },
  typeTextExpense: { color: Colors.red },
  typeTextIncome: { color: Colors.green },
  amountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl, marginBottom: Spacing.xl, justifyContent: 'center' },
  amountPrefix: { fontSize: 32, fontWeight: Typography.bold, color: Colors.accent, marginRight: 4 },
  amountInput: { fontSize: 42, fontWeight: Typography.bold, color: Colors.text, minWidth: 120 },
  fieldGroup: { marginBottom: Spacing.lg },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text },
  notesInput: { height: 80, textAlignVertical: 'top' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipIcon: { fontSize: 16 },
  catChipLabel: { fontSize: Typography.sm, color: Colors.muted, fontWeight: Typography.medium },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, padding: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.bg },
});
