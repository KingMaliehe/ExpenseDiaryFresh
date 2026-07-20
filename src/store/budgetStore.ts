// src/store/budgetStore.ts
// New store — centralizes the budget logic that used to be inlined in
// app/(tabs)/budgets.tsx. Same idea as the transaction store.
import { create } from 'zustand';
import { api } from '../services/apiClient';
import { Budget } from '../types/database';

interface BudgetState {
  budgets: Budget[];
  loading: boolean;
  error: string | null;

  fetchBudgets: (month?: number, year?: number) => Promise<void>;
  upsertBudget: (input: {
    id?: string;
    category_id: string;
    limit_amount: number;
    month: number;
    year: number;
    alert_at_percent?: number;
  }) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  loading: false,
  error: null,

  fetchBudgets: async (month, year) => {
    set({ loading: true, error: null });
    try {
      const now = new Date();
      const m = month ?? now.getMonth() + 1;
      const y = year ?? now.getFullYear();
      const budgets = await api.budgets.list({ month: m, year: y });
      set({ budgets });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  upsertBudget: async ({ id, ...body }) => {
    try {
      const saved = id
        ? await api.budgets.update(id, body as any)
        : await api.budgets.create(body);
      const list = get().budgets.filter((b) => b.id !== saved.id);
      set({ budgets: [...list, saved] });
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    }
  },

  deleteBudget: async (id) => {
    const prev = get().budgets;
    set({ budgets: prev.filter((b) => b.id !== id) });
    try {
      await api.budgets.remove(id);
    } catch (e: any) {
      set({ budgets: prev, error: e.message });
    }
  },
}));
