// src/store/transactionStore.ts
// Same public surface as before — fetchTransactions/addTransaction/etc — so
// the dashboard/transactions/add screens don't need changes. Optimistic
// add/delete preserved.
import { create } from 'zustand';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { api } from '../services/apiClient';
import { Transaction } from '../types/database';
import { useAuthStore } from './authStore';
import { queueOperation } from '../services/offlineSync';

interface TransactionState {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;

  totalIncome: number;
  totalExpenses: number;
  netSavings: number;

  fetchTransactions: (month?: Date) => Promise<void>;
  addTransaction: (
    tx: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'client_id' | 'synced_at'>,
  ) => Promise<void>;
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
      const from = format(startOfMonth(month), 'yyyy-MM-dd');
      const to = format(endOfMonth(month), 'yyyy-MM-dd');
      const data = await api.transactions.list({ from, to });
      set({ transactions: data });
      get().computeSummary();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  addTransaction: async (tx) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    const clientId = `${user.id}-${Date.now()}`;
    const payload = {
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      category_id: tx.category_id ?? null,
      notes: tx.notes ?? null,
      is_recurring: tx.is_recurring ?? false,
      client_id: clientId,
    };

    // Optimistic insert with a temporary row keyed by clientId.
    const tempTx: Transaction = {
      id: clientId,
      user_id: user.id,
      category_id: tx.category_id ?? null,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      date: tx.date,
      notes: tx.notes ?? null,
      is_recurring: tx.is_recurring ?? false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      client_id: clientId,
      synced_at: null,
    };
    set((state) => ({ transactions: [tempTx, ...state.transactions] }));
    get().computeSummary();

    try {
      const real = await api.transactions.create(payload);
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === clientId ? real : t)),
      }));
      get().computeSummary();
    } catch (e: any) {
      // If we appear to be offline, leave the optimistic row in place and
      // queue the operation for later sync. Otherwise rollback + report.
      if (isNetworkError(e)) {
        await queueOperation({ table: 'transactions', operation: 'insert', payload });
      } else {
        set((state) => ({
          transactions: state.transactions.filter((t) => t.id !== clientId),
          error: e.message,
        }));
        get().computeSummary();
      }
    }
  },

  updateTransaction: async (id, updates) => {
    try {
      const real = await api.transactions.update(id, updates);
      set((state) => ({
        transactions: state.transactions.map((t) => (t.id === id ? real : t)),
      }));
      get().computeSummary();
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  deleteTransaction: async (id) => {
    const prev = get().transactions;
    set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
    get().computeSummary();
    try {
      await api.transactions.remove(id);
    } catch (e: any) {
      set({ transactions: prev, error: e.message });
      get().computeSummary();
    }
  },

  computeSummary: () => {
    const { transactions } = get();
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    set({ totalIncome, totalExpenses, netSavings: totalIncome - totalExpenses });
  },
}));

// Heuristic — fetch throws TypeError on actual network failure. Server-side
// errors (4xx/5xx) come back as ApiError, which we want to surface.
function isNetworkError(e: any): boolean {
  return e?.name === 'TypeError' || /network|fetch/i.test(e?.message ?? '');
}
