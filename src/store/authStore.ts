// src/store/authStore.ts
import { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "../services/supabase";
import { Profile } from "../types/database";

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean; // true while sign-in/sign-up is in progress
  initializing: boolean; // true until first session check completes
  error: string | null;

  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  setSession: (session: Session | null) => void;
  setInitialized: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: false,
  initializing: true,
  error: null,

  setInitialized: () => set({ initializing: false }),

  setSession: (session) => {
    set({ session, user: session?.user ?? null, initializing: false });
    if (session?.user) get().loadProfile();
  },

  signUp: async (email, password, fullName) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw error;
      set({ session: data.session, user: data.user });
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      set({ session: data.session, user: data.user });
      await get().loadProfile();
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "expensediarysa://reset-password",
      });
      if (error) throw error;
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  loadProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (data) set({ profile: data });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .single();
    if (!error && data) set({ profile: data });
  },

  clearError: () => set({ error: null }),
}));
