// app/(tabs)/dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { format, subMonths, addMonths } from 'date-fns';
import { useTransactionStore } from '../../src/store/transactionStore';
import { useAuthStore } from '../../src/store/authStore';
import { formatMoney } from '../../src/lib/currency';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';
import { Transaction } from '../../src/types/database';

export default function DashboardScreen() {
  const { profile } = useAuthStore();
  const formatRand = (n: number) => formatMoney(n, profile?.currency);
  const { transactions, totalIncome, totalExpenses, netSavings, loading, fetchTransactions } = useTransactionStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchTransactions(currentMonth);
    }, [currentMonth])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions(currentMonth);
    setRefreshing(false);
  };

  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const nextMonth = () => {
    const next = addMonths(currentMonth, 1);
    if (next <= new Date()) setCurrentMonth(next);
  };

  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const recent = transactions.slice(0, 5);

  // Category totals
  const categoryTotals: Record<string, { name: string; icon: string; color: string; amount: number }> = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    if (!t.category) return;
    const key = t.category_id ?? 'other';
    if (!categoryTotals[key]) {
      categoryTotals[key] = { name: t.category.name, icon: t.category.icon, color: t.category.color, amount: 0 };
    }
    categoryTotals[key].amount += t.amount;
  });
  const topCategories = Object.values(categoryTotals).sort((a, b) => b.amount - a.amount).slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋</Text>
          <Text style={styles.subGreeting}>Here's your financial overview</Text>
        </View>
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{format(currentMonth, 'MMM yyyy')}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
            <Text style={styles.monthBtnText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <>
          {/* KPI cards */}
          <View style={styles.kpiGrid}>
            <KPICard label="Income" value={formatRand(totalIncome)} color={Colors.green} delta="This month" />
            <KPICard label="Expenses" value={formatRand(totalExpenses)} color={Colors.text} delta="This month" />
            <KPICard label="Savings" value={formatRand(netSavings)} color={netSavings >= 0 ? Colors.green : Colors.red} delta={`${savingsRate}% rate`} />
          </View>

          {/* Budget progress */}
          {totalIncome > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Monthly spend</Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, {
                  width: `${Math.min(100, (totalExpenses / totalIncome) * 100)}%` as any,
                  backgroundColor: totalExpenses / totalIncome > 0.8 ? Colors.red : Colors.accent,
                }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLeft}>{formatRand(totalExpenses)} spent</Text>
                <Text style={styles.progressRight}>{formatRand(totalIncome)} income</Text>
              </View>
            </View>
          )}

          {/* Top categories */}
          {topCategories.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Top spending categories</Text>
              {topCategories.map((cat) => (
                <View key={cat.name} style={styles.catRow}>
                  <View style={styles.catLeft}>
                    <Text style={styles.catIcon}>{cat.icon}</Text>
                    <Text style={styles.catName}>{cat.name}</Text>
                  </View>
                  <View style={styles.catRight}>
                    <Text style={styles.catAmount}>{formatRand(cat.amount)}</Text>
                    <Text style={styles.catPct}>
                      {totalExpenses > 0 ? Math.round((cat.amount / totalExpenses) * 100) : 0}%
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Recent transactions */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Recent transactions</Text>
            </View>
            {recent.length === 0 ? (
              <Text style={styles.emptyText}>No transactions yet. Tap + to add one.</Text>
            ) : (
              recent.map((tx) => <TxRow key={tx.id} tx={tx} />)
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function KPICard({ label, value, color, delta }: { label: string; value: string; color: string; delta: string }) {
  return (
    <View style={kpiStyles.card}>
      <Text style={kpiStyles.label}>{label}</Text>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={kpiStyles.delta}>{delta}</Text>
    </View>
  );
}

function TxRow({ tx }: { tx: Transaction }) {
  const currency = useAuthStore((s) => s.profile?.currency);
  const isIncome = tx.type === 'income';
  return (
    <View style={txStyles.row}>
      <View style={[txStyles.icon, { backgroundColor: (tx.category?.color ?? Colors.muted) + '22' }]}>
        <Text style={txStyles.iconText}>{tx.category?.icon ?? '📌'}</Text>
      </View>
      <View style={txStyles.info}>
        <Text style={txStyles.desc} numberOfLines={1}>{tx.description}</Text>
        <Text style={txStyles.cat}>{tx.category?.name ?? 'Uncategorised'}</Text>
      </View>
      <View style={txStyles.right}>
        <Text style={[txStyles.amount, { color: isIncome ? Colors.green : Colors.text }]}>
          {isIncome ? '+' : '-'}{formatMoney(tx.amount, currency)}
        </Text>
        <Text style={txStyles.date}>{tx.date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.xl },
  greeting: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.text },
  subGreeting: { fontSize: Typography.sm, color: Colors.muted, marginTop: 2 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 10, paddingVertical: 6 },
  monthBtn: { padding: 2 },
  monthBtnText: { fontSize: 18, color: Colors.muted },
  monthLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.text, minWidth: 64, textAlign: 'center' },
  kpiGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: 14 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.text, marginBottom: Spacing.md },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  progressTrack: { height: 6, backgroundColor: Colors.surface3, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLeft: { fontSize: Typography.xs, color: Colors.muted },
  progressRight: { fontSize: Typography.xs, color: Colors.muted },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catIcon: { fontSize: 18 },
  catName: { fontSize: Typography.base, color: Colors.text },
  catRight: { alignItems: 'flex-end' },
  catAmount: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  catPct: { fontSize: Typography.xs, color: Colors.muted },
  emptyText: { fontSize: Typography.base, color: Colors.muted, textAlign: 'center', paddingVertical: Spacing.xl },
});

const kpiStyles = StyleSheet.create({
  card: { flex: 1, backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md },
  label: { fontSize: Typography.xs, color: Colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: Typography.md, fontWeight: Typography.bold },
  delta: { fontSize: Typography.xs, color: Colors.subtle, marginTop: 2 },
});

const txStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 18 },
  info: { flex: 1 },
  desc: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.text },
  cat: { fontSize: Typography.xs, color: Colors.muted, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: Typography.base, fontWeight: Typography.semibold },
  date: { fontSize: Typography.xs, color: Colors.muted, marginTop: 1 },
});
