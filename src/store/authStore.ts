// src/store/authStore.ts
// Rewritten for the custom backend. Keeps the same public shape as the old
// Supabase version so the screens (login, signup, forgot-password, profile)
// don't need touching — they call useAuthStore() the same way.
//
// What changed:
//   - Session type is just our StoredUser (no Supabase Session object)
//   - signUp/signIn/signOut/resetPassword now call api.auth.*
//   - setSession kept for the layout's bootstrap callback
import { create } from 'zustand';
import { api } from '../services/apiClient';
import { tokenStore, StoredUser } from '../services/tokenStore';
import { Profile } from '../types/database';

// Kept this shape so the existing _layout.tsx code (which destructures from
// the store) stays drop-in compatible.
export type Session = { user: StoredUser } | null;

interface AuthState {
  session: Session;
  user: StoredUser | null;
  profile: Profile | null;
  loading: boolean;
  initializing: boolean;
  error: string | null;

  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Step 1 of the 3-step reset (request OTP). Kept the name for screen compat.
  resetPassword: (email: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  setSession: (session: Session) => void;
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
      const user = await api.auth.signUp(email, password, fullName);
      set({ session: { user }, user });
      await get().loadProfile();
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
      const user = await api.auth.signIn(email, password);
      set({ session: { user }, user });
      await get().loadProfile();
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await api.auth.signOut();
    set({ session: null, user: null, profile: null });
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await api.auth.forgotPassword(email);
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  loadProfile: async () => {
    if (!get().user) return;
    try {
      const profile = await api.profile.get();
      set({ profile });
    } catch {
      // Profile fetch is non-critical at boot — fail silently.
    }
  },

  updateProfile: async (updates) => {
    if (!get().user) return;
    try {
      const profile = await api.profile.update(updates);
      set({ profile });
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  clearError: () => set({ error: null }),
}));

// Restores a session on app launch and pushes it into the store.
// Called from app/_layout.tsx in the rewrite below.
export async function bootstrapSession(): Promise<void> {
  const user = await api.auth.getCurrentUser();
  useAuthStore.getState().setSession(user ? { user } : null);
  useAuthStore.getState().setInitialized();
}

// Exposed so we can also expire the local session if the API client tells us
// the refresh failed (see apiClient.onSessionChange wiring in _layout).
export function clearLocalSession() {
  useAuthStore.setState({ session: null, user: null, profile: null });
}
