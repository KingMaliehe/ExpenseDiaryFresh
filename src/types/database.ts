// src/types/database.ts
// These mirror the backend's Prisma models (backend/prisma/schema.prisma)

export type TransactionType = 'income' | 'expense';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  monthly_income: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_default: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string | null;
  description: string;
  amount: number;
  type: TransactionType;
  date: string;
  notes: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
  client_id: string | null;
  synced_at: string | null;
  // Joined
  category?: Category;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  limit_amount: number;
  month: number;
  year: number;
  alert_at_percent: number;
  created_at: string;
  // Joined
  category?: Category;
  spent?: number;
}

export interface MonthlySummary {
  user_id: string;
  month: string;
  total_income: number;
  total_expenses: number;
  net_savings: number;
}

// Supabase Database generic type
export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      categories: { Row: Category; Insert: Omit<Category, 'id' | 'created_at'>; Update: Partial<Category> };
      transactions: { Row: Transaction; Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Transaction> };
      budgets: { Row: Budget; Insert: Omit<Budget, 'id' | 'created_at'>; Update: Partial<Budget> };
    };
    Views: {
      monthly_summary: { Row: MonthlySummary };
    };
  };
}
