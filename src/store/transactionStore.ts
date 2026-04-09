// src/store/transactionStore.ts
import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { Transaction } from '../types/database';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;

  // Summary derived values
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;

  // Actions
  fetchTransactions: (month?: Date) => Promise<void>;
  addTransaction: (tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'client_id' | 'synced_at'>) => Promise<void>;
  updateTransaction: (id: string, updates: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  computeSummary: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  loading: false,
  error: null,
  totalIncome: 0,
  totalExpenses: 0,
  netSavings: 0,

  fetchTransactions: async (month = new Date()) => {
    set({ loading: true, error: null });
    try {
      const start = format(startOfMonth(month), 'yyyy-MM-dd');
      const end = format(endOfMonth(month), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:categories(id, name, icon, color)
        `)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      set({ transactions: data ?? [] });
      get().computeSummary();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  addTransaction: async (tx) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const clientId = `${userData.user.id}-${Date.now()}`;
    const newTx = {
      ...tx,
      user_id: userData.user.id,
      client_id: clientId,
    };

    // Optimistic insert
    const tempTx: Transaction = {
      ...newTx,
      id: clientId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced_at: null,
      notes: tx.notes ?? null,
    };

    set((state) => ({
      transactions: [tempTx, ...state.transactions],
    }));
    get().computeSummary();

    // Persist to Supabase
    const { data, error } = await supabase
      .from('transactions')
      .insert(newTx)
      .select(`*, category:categories(id, name, icon, color)`)
      .single();

    if (error) {
      // Rollback on failure
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== clientId),
        error: error.message,
      }));
      get().computeSummary();
    } else if (data) {
      // Replace temp with real record
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === clientId ? data : t)),
      }));
    }
  },

  updateTransaction: async (id, updates) => {
    const { error } = await supabase
      .from('transactions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t.id === id ? { ...t, ...updates } : t
        ),
      }));
      get().computeSummary();
    }
  },

  deleteTransaction: async (id) => {
    const prev = get().transactions;
    // Optimistic delete
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }));
    get().computeSummary();

    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) {
      set({ transactions: prev, error: error.message });
      get().computeSummary();
    }
  },

  computeSummary: () => {
    const { transactions } = get();
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    set({ totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses });
  },
}));
