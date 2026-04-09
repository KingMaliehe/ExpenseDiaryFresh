// app/(tabs)/budgets.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format } from 'date-fns';
import { supabase } from '../../src/services/supabase';
import { useAuthStore } from '../../src/store/authStore';
import { Budget, Category } from '../../src/types/database';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

const formatRand = (n: number) => 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2 });

interface BudgetWithSpent extends Budget {
  spent: number;
  category: Category;
}

export default function BudgetsScreen() {
  const { user } = useAuthStore();
  const [budgets, setBudgets] = useState<BudgetWithSpent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [limitAmount, setLimitAmount] = useState('');
  const [alertPercent, setAlertPercent] = useState('80');
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch budgets with category info
      const { data: budgetData } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('user_id', user.id)
        .eq('month', month)
        .eq('year', year);

      // Fetch spending per category this month
      const start = format(new Date(year, month - 1, 1), 'yyyy-MM-dd');
      const end = format(new Date(year, month, 0), 'yyyy-MM-dd');
      const { data: txData } = await supabase
        .from('transactions')
        .select('category_id, amount')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .gte('date', start)
        .lte('date', end);

      // Sum spending per category
      const spentMap: Record<string, number> = {};
      (txData ?? []).forEach((tx) => {
        if (tx.category_id) spentMap[tx.category_id] = (spentMap[tx.category_id] ?? 0) + tx.amount;
      });

      const enriched = (budgetData ?? []).map((b: any) => ({
        ...b,
        spent: spentMap[b.category_id] ?? 0,
      }));
      setBudgets(enriched);

      // Fetch categories for the add modal
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .neq('name', 'Income')
        .order('name');
      setCategories(catData ?? []);
    } finally {
      setLoading(false);
    }
  }, [user, month, year]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleSaveBudget = async () => {
    if (!selectedCategory) { Alert.alert('Error', 'Select a category.'); return; }
    const amount = parseFloat(limitAmount.replace(',', '.'));
    if (!amount || amount <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    setSaving(true);
    try {
      await supabase.from('budgets').upsert({
        user_id: user!.id,
        category_id: selectedCategory.id,
        limit_amount: amount,
        month,
        year,
        alert_at_percent: parseInt(alertPercent) || 80,
      }, { onConflict: 'user_id,category_id,month,year' });
      setModalVisible(false);
      setSelectedCategory(null);
      setLimitAmount('');
      await fetchData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = (budget: BudgetWithSpent) => {
    Alert.alert('Delete budget', `Remove budget for ${budget.category.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('budgets').delete().eq('id', budget.id);
          await fetchData();
        }
      },
    ]);
  };

  const totalBudget = budgets.reduce((s, b) => s + b.limit_amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.spent > b.limit_amount).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Budgets</Text>
            <Text style={styles.subtitle}>{format(now, 'MMMM yyyy')}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Summary strip */}
        <View style={styles.summaryRow}>
          <SummaryCard label="Total budget" value={formatRand(totalBudget)} />
          <SummaryCard label="Total spent" value={formatRand(totalSpent)} valueColor={totalSpent > totalBudget ? Colors.red : Colors.text} />
          <SummaryCard label="Over budget" value={`${overBudgetCount}`} valueColor={overBudgetCount > 0 ? Colors.red : Colors.green} />
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
        ) : budgets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>No budgets yet</Text>
            <Text style={styles.emptyText}>Set spending limits per category to stay on track.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>Create your first budget</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map((b) => <BudgetCard key={b.id} budget={b} onLongPress={() => handleDeleteBudget(b)} />)
        )}
      </ScrollView>

      {/* Add budget modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set budget</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.catGrid}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, selectedCategory?.id === cat.id && { borderColor: cat.color, backgroundColor: cat.color + '22' }]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={{ fontSize: 16 }}>{cat.icon}</Text>
                    <Text style={[styles.catChipLabel, selectedCategory?.id === cat.id && { color: cat.color }]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Monthly limit (R)</Text>
              <TextInput
                style={styles.input}
                value={limitAmount}
                onChangeText={setLimitAmount}
                placeholder="e.g. 3000"
                placeholderTextColor={Colors.subtle}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>Alert at (%)</Text>
              <TextInput
                style={styles.input}
                value={alertPercent}
                onChangeText={setAlertPercent}
                placeholder="80"
                placeholderTextColor={Colors.subtle}
                keyboardType="number-pad"
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSaveBudget} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save budget'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function BudgetCard({ budget, onLongPress }: { budget: BudgetWithSpent; onLongPress: () => void }) {
  const pct = Math.min(100, (budget.spent / budget.limit_amount) * 100);
  const over = budget.spent > budget.limit_amount;
  const nearLimit = pct >= budget.alert_at_percent && !over;
  const barColor = over ? Colors.red : nearLimit ? Colors.orange : Colors.accent;
  const remaining = budget.limit_amount - budget.spent;

  return (
    <TouchableOpacity style={styles.budgetCard} onLongPress={onLongPress} activeOpacity={0.8}>
      <View style={styles.budgetTop}>
        <View style={styles.budgetLeft}>
          <View style={[styles.budgetIconWrap, { backgroundColor: budget.category.color + '22' }]}>
            <Text style={{ fontSize: 20 }}>{budget.category.icon}</Text>
          </View>
          <View>
            <Text style={styles.budgetCatName}>{budget.category.name}</Text>
            <Text style={[styles.budgetStatus, { color: over ? Colors.red : nearLimit ? Colors.orange : Colors.muted }]}>
              {over ? `Over by R ${(budget.spent - budget.limit_amount).toFixed(0)}` : nearLimit ? 'Approaching limit' : `R ${remaining.toFixed(0)} left`}
            </Text>
          </View>
        </View>
        <View style={styles.budgetRight}>
          <Text style={[styles.budgetSpent, { color: over ? Colors.red : Colors.text }]}>
            R {budget.spent.toFixed(0)}
          </Text>
          <Text style={styles.budgetLimit}>/ R {budget.limit_amount.toFixed(0)}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.budgetPct}>{Math.round(pct)}% used</Text>
    </TouchableOpacity>
  );
}

function SummaryCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  title: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.text },
  subtitle: { fontSize: Typography.sm, color: Colors.muted, marginTop: 2 },
  addBtn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.bg },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.xl },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  summaryLabel: { fontSize: Typography.xs, color: Colors.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.text },
  budgetCard: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: 12 },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  budgetCatName: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.text },
  budgetStatus: { fontSize: Typography.xs, marginTop: 2 },
  budgetRight: { alignItems: 'flex-end' },
  budgetSpent: { fontSize: Typography.lg, fontWeight: Typography.bold },
  budgetLimit: { fontSize: Typography.xs, color: Colors.muted },
  progressTrack: { height: 6, backgroundColor: Colors.surface3, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  budgetPct: { fontSize: Typography.xs, color: Colors.muted },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text, marginBottom: 8 },
  emptyText: { fontSize: Typography.base, color: Colors.muted, textAlign: 'center', marginBottom: Spacing.xl },
  emptyBtn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: 24, paddingVertical: 12 },
  emptyBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.bg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: Colors.border, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: Typography.xl, fontWeight: Typography.semibold, color: Colors.text },
  modalClose: { fontSize: 20, color: Colors.muted },
  modalBody: { padding: Spacing.xl },
  fieldLabel: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface2 },
  catChipLabel: { fontSize: Typography.xs, color: Colors.muted, fontWeight: Typography.medium },
  input: { backgroundColor: Colors.surface2, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: Typography.md, color: Colors.text },
  modalFooter: { flexDirection: 'row', gap: 10, padding: Spacing.xl, borderTopWidth: 1, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, backgroundColor: Colors.surface2, borderRadius: Radius.sm, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  cancelBtnText: { color: Colors.muted, fontWeight: Typography.medium },
  saveBtn: { flex: 2, backgroundColor: Colors.accent, borderRadius: Radius.sm, padding: Spacing.md, alignItems: 'center' },
  saveBtnText: { color: Colors.bg, fontWeight: Typography.semibold },
});
