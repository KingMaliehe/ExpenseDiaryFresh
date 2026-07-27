// app/(tabs)/transactions.tsx
import { useFocusEffect } from 'expo-router';
import { format, parseISO } from 'date-fns';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import DateField from '../../components/DateField';
import { confirmAsync } from '../../src/lib/confirm';
import { currencyInfo, formatMoney } from '../../src/lib/currency';
import { api } from '../../src/services/apiClient';
import { useAuthStore } from '../../src/store/authStore';
import { useTransactionStore } from '../../src/store/transactionStore';
import { Colors, Radius, Spacing, Typography } from '../../src/theme';
import { Category, Transaction, TransactionType } from '../../src/types/database';

export default function TransactionsScreen() {
  const { transactions, loading, fetchTransactions, deleteTransaction, updateTransaction } =
    useTransactionStore();
  const currency = useAuthStore((s) => s.profile?.currency);
  const symbol = currencyInfo(currency).symbol;
  const money = (n: number) => formatMoney(n, currency);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Categories are needed by the edit modal's category picker.
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => setCategories([]));
  }, []);

  // --- Edit modal state ---
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [eType, setEType] = useState<TransactionType>('expense');
  const [eDescription, setEDescription] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eCategoryId, setECategoryId] = useState<string | null>(null);
  const [eDate, setEDate] = useState(new Date());
  const [eNotes, setENotes] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => { fetchTransactions(); }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  };

  const filtered = transactions.filter((tx) => {
    const matchSearch = tx.description.toLowerCase().includes(search.toLowerCase()) ||
      (tx.category?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || tx.type === filter;
    return matchSearch && matchFilter;
  });

  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setEType(tx.type);
    setEDescription(tx.description);
    setEAmount(String(tx.amount));
    setECategoryId(tx.category_id ?? null);
    setEDate(tx.date ? parseISO(tx.date) : new Date());
    setENotes(tx.notes ?? '');
  };

  const closeEdit = () => setEditing(null);

  const filteredCats = categories.filter((c) =>
    eType === 'income' ? c.name === 'Income' || c.name === 'Savings' : c.name !== 'Income',
  );

  const saveEdit = async () => {
    if (!editing) return;
    if (!eDescription.trim()) {
      Alert.alert('Missing description', 'Please enter a description.');
      return;
    }
    const parsedAmount = parseFloat(eAmount.replace(',', '.'));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    setSaving(true);
    try {
      await updateTransaction(editing.id, {
        description: eDescription.trim(),
        amount: parsedAmount,
        type: eType,
        date: format(eDate, 'yyyy-MM-dd'),
        category_id: eCategoryId,
        notes: eNotes.trim() || null,
      });
      closeEdit();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async (tx: Transaction) => {
    const ok = await confirmAsync(
      'Delete transaction',
      `Delete "${tx.description}" for ${money(tx.amount)}?`,
      'Delete',
      true,
    );
    if (ok) deleteTransaction(tx.id);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search…"
          placeholderTextColor={Colors.subtle}
        />
        <View style={styles.filterRow}>
          {(['all', 'income', 'expense'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading…' : 'No transactions found.'}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.txItem}
            onPress={() => openEdit(item)}
            onLongPress={() => confirmDelete(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.txIcon, { backgroundColor: (item.category?.color ?? Colors.muted) + '22' }]}>
              <Text style={{ fontSize: 20 }}>{item.category?.icon ?? '📌'}</Text>
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.txMeta}>{item.category?.name ?? 'Uncategorised'} • {item.date}</Text>
            </View>
            <Text style={[styles.txAmount, { color: item.type === 'income' ? Colors.green : Colors.text }]}>
              {item.type === 'income' ? '+' : '-'}{money(item.amount)}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Edit transaction modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={closeEdit}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeEdit}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit entry</Text>
              <TouchableOpacity onPress={saveEdit} disabled={saving}>
                <Text style={[styles.modalSave, saving && { opacity: 0.5 }]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Type toggle */}
              <View style={styles.typeToggle}>
                {(['expense', 'income'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeBtn,
                      eType === t && (t === 'expense' ? styles.typeBtnExpense : styles.typeBtnIncome),
                    ]}
                    onPress={() => { setEType(t); setECategoryId(null); }}
                  >
                    <Text style={[
                      styles.typeBtnText,
                      eType === t && (t === 'expense' ? styles.typeTextExpense : styles.typeTextIncome),
                    ]}>
                      {t === 'expense' ? '💸 Expense' : '💰 Income'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Amount */}
              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.amountPrefix}>{symbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={eAmount}
                  onChangeText={setEAmount}
                  placeholder="0.00"
                  placeholderTextColor={Colors.subtle}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Description */}
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={eDescription}
                onChangeText={setEDescription}
                placeholder="e.g. Woolworths groceries"
                placeholderTextColor={Colors.subtle}
              />

              {/* Category */}
              <Text style={styles.label}>Category</Text>
              <View style={styles.catGrid}>
                {filteredCats.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      eCategoryId === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '22' },
                    ]}
                    onPress={() => setECategoryId(cat.id)}
                  >
                    <Text style={styles.catChipIcon}>{cat.icon}</Text>
                    <Text style={[styles.catChipLabel, eCategoryId === cat.id && { color: cat.color }]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date */}
              <Text style={styles.label}>Date</Text>
              <DateField value={eDate} onChange={setEDate} maximumDate={new Date()} />

              {/* Notes */}
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={styles.notesInput}
                value={eNotes}
                onChangeText={setENotes}
                placeholder="Any extra details…"
                placeholderTextColor={Colors.subtle}
                multiline
                textAlignVertical="top"
              />

              {/* Delete */}
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={async () => {
                  if (!editing) return;
                  const tx = editing;
                  const ok = await confirmAsync(
                    'Delete transaction',
                    `Delete "${tx.description}" for ${money(tx.amount)}?`,
                    'Delete',
                    true,
                  );
                  if (ok) {
                    closeEdit();
                    deleteTransaction(tx.id);
                  }
                }}
              >
                <Text style={styles.deleteBtnText}>Delete transaction</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md, backgroundColor: Colors.bg },
  title: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text, marginBottom: Spacing.md },
  search: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: 10, fontSize: Typography.base, color: Colors.text, marginBottom: Spacing.md },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  filterBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { fontSize: Typography.sm, color: Colors.muted, fontWeight: Typography.medium },
  filterTextActive: { color: Colors.bg },
  list: { paddingHorizontal: Spacing.xl, paddingBottom: 40 },
  empty: { textAlign: 'center', color: Colors.muted, fontSize: Typography.base, marginTop: 60 },
  txItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  txMeta: { fontSize: Typography.xs, color: Colors.muted, marginTop: 2 },
  txAmount: { fontSize: Typography.base, fontWeight: Typography.semibold },

  // Edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: Colors.border,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.text },
  modalCancel: { fontSize: Typography.base, color: Colors.muted },
  modalSave: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.semibold },
  modalBody: { padding: Spacing.xl },
  label: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: Spacing.lg },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text },
  notesInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text, height: 90, textAlignVertical: 'top' },
  amountRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  amountPrefix: { fontSize: 24, fontWeight: Typography.bold, color: Colors.accent, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: Typography.bold, color: Colors.text, paddingVertical: Spacing.sm },
  typeToggle: { flexDirection: 'row', backgroundColor: Colors.surface2, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  typeBtn: { flex: 1, padding: 12, alignItems: 'center' },
  typeBtnExpense: { backgroundColor: 'rgba(248,81,73,0.15)' },
  typeBtnIncome: { backgroundColor: 'rgba(63,185,80,0.15)' },
  typeBtnText: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.muted },
  typeTextExpense: { color: Colors.red },
  typeTextIncome: { color: Colors.green },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  catChipIcon: { fontSize: 16 },
  catChipLabel: { fontSize: Typography.sm, color: Colors.muted, fontWeight: Typography.medium },
  deleteBtn: { marginTop: Spacing.xxl, padding: Spacing.md, alignItems: 'center', borderRadius: Radius.sm, borderWidth: 1, borderColor: 'rgba(248,81,73,0.3)', backgroundColor: 'rgba(248,81,73,0.1)' },
  deleteBtnText: { fontSize: Typography.base, color: Colors.red, fontWeight: Typography.semibold },
});
