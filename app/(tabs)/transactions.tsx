// app/(tabs)/transactions.tsx
import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTransactionStore } from '../../src/store/transactionStore';
import { Transaction } from '../../src/types/database';
import { Colors, Spacing, Radius, Typography } from '../../src/theme';

const formatRand = (n: number) => 'R ' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2 });

export default function TransactionsScreen() {
  const { transactions, loading, fetchTransactions, deleteTransaction } = useTransactionStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [refreshing, setRefreshing] = useState(false);

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

  const confirmDelete = (tx: Transaction) => {
    Alert.alert(
      'Delete transaction',
      `Delete "${tx.description}" for ${formatRand(tx.amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(tx.id) },
      ]
    );
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
              {item.type === 'income' ? '+' : '-'}{formatRand(item.amount)}
            </Text>
          </TouchableOpacity>
        )}
      />
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
});
