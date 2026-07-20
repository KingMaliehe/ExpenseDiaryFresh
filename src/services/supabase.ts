// DEPRECATED — Supabase has been replaced by our custom backend.
//
// If you're seeing this file in an import, swap it out:
//   - For data calls (categories, transactions, budgets, profile, summary):
//       import { api } from './apiClient';
//   - For auth state (session, user, signIn, signUp, signOut, etc):
//       import { useAuthStore } from '../store/authStore';
//   - For password reset:
//       api.auth.forgotPassword(email);
//       api.auth.verifyOtp(email, code);
//       api.auth.resetPassword(resetToken, password);
//
// This stub stays here so accidental imports surface a loud, helpful error
// instead of mysterious "supabase is undefined" runtime failures.
const message =
  '[supabase.ts is removed] Use `api` from services/apiClient or `useAuthStore` from store/authStore.';

export const supabase: any = new Proxy(
  {},
  {
    get() {
      throw new Error(message);
    },
  },
);
