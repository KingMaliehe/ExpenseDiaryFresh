// Single HTTP client for talking to our backend.
//
// Responsibilities:
//   - Attach the Bearer access token to every authenticated call
//   - On 401, automatically refresh tokens once and retry; if that fails,
//     clear local tokens and notify the app to bounce the user to login
//   - Provide typed methods for every endpoint so callers stay terse
//
// API URL is read from EXPO_PUBLIC_API_URL (set in .env, plumbed via
// app.config.ts). Falls back to localhost for emulator/web debugging.
import Constants from 'expo-constants';
import { tokenStore, StoredUser } from './tokenStore';
import {
  Profile,
  Category,
  Transaction,
  Budget,
  MonthlySummary,
  TransactionType,
} from '../types/database';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra as any)?.apiUrl ||
  'http://localhost:4000';

// ---------------------------------------------------------------------------
// Session change notifier — replaces supabase.auth.onAuthStateChange
// ---------------------------------------------------------------------------
type SessionListener = (user: StoredUser | null) => void;
const listeners = new Set<SessionListener>();

export function onSessionChange(fn: SessionListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(user: StoredUser | null) {
  for (const fn of listeners) fn(user);
}

// ---------------------------------------------------------------------------
// Low-level request helper — handles auth header + 401 refresh + retry
// ---------------------------------------------------------------------------
type RequestOpts = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: any;
  auth?: boolean; // default true
};

class ApiError extends Error {
  status: number;
  code: string;
  details?: any;
  constructor(status: number, code: string, message: string, details?: any) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// One-flight refresh: if a request triggers a refresh while another request is
// already refreshing, both wait on the same promise to avoid double-spending
// the refresh token.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refresh = await tokenStore.getRefresh();
      if (!refresh) return false;
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      const json = await res.json();
      await tokenStore.setTokens(json.accessToken, json.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T = any>(path: string, opts: RequestOpts = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const useAuth = opts.auth !== false;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useAuth) {
    const token = await tokenStore.getAccess();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res = await doFetch();

  // 401 → try one refresh + retry. If refresh fails, clear session.
  if (res.status === 401 && useAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const token = await tokenStore.getAccess();
      if (token) headers.Authorization = `Bearer ${token}`;
      res = await doFetch();
    }
    if (res.status === 401) {
      await tokenStore.clear();
      notify(null);
      throw new ApiError(401, 'unauthenticated', 'Session expired. Please sign in again.');
    }
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let json: any = null;
  if (text) {
    try { json = JSON.parse(text); } catch { /* keep raw text */ }
  }

  if (!res.ok) {
    const code = (json && json.error) || 'http_error';
    const msg = (json && json.message) || friendlyError(code, res.status);
    throw new ApiError(res.status, code, msg, json?.issues);
  }
  return json as T;
}

function friendlyError(code: string, status: number): string {
  switch (code) {
    case 'invalid_credentials': return 'Email or password is incorrect.';
    case 'same_password':       return 'Your new password must be different from the current one.';
    case 'email_taken':         return 'An account with that email already exists.';
    case 'invalid_code':        return 'The code is incorrect or has expired.';
    case 'invalid_reset_token': return 'Your reset session expired. Please start again.';
    case 'too_many_attempts':   return 'Too many attempts. Please wait a few minutes.';
    case 'too_many_requests':   return 'Too many requests. Please wait and try again.';
    case 'budget_exists':       return 'A budget for that category and month already exists.';
    default: return `Request failed (${status})`;
  }
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------
type AuthResponse = {
  user: StoredUser;
  accessToken: string;
  refreshToken: string;
};

export const api = {
  // ---------- Health ----------
  health: () => request('/health', { auth: false }),

  // ---------- Auth ----------
  auth: {
    async signUp(email: string, password: string, fullName?: string) {
      const res = await request<AuthResponse>('/auth/signup', {
        method: 'POST',
        auth: false,
        body: { email, password, fullName },
      });
      await tokenStore.setTokens(res.accessToken, res.refreshToken);
      await tokenStore.setUser(res.user);
      notify(res.user);
      return res.user;
    },

    async signIn(email: string, password: string) {
      const res = await request<AuthResponse>('/auth/signin', {
        method: 'POST',
        auth: false,
        body: { email, password },
      });
      await tokenStore.setTokens(res.accessToken, res.refreshToken);
      await tokenStore.setUser(res.user);
      notify(res.user);
      return res.user;
    },

    async signOut() {
      const refresh = await tokenStore.getRefresh();
      try {
        await request('/auth/signout', {
          method: 'POST',
          auth: false,
          body: { refreshToken: refresh ?? '' },
        });
      } catch { /* always succeed locally */ }
      await tokenStore.clear();
      notify(null);
    },

    async getCurrentUser(): Promise<StoredUser | null> {
      // Try cached user first for instant UI; verify in the background.
      const cached = await tokenStore.getUser();
      const access = await tokenStore.getAccess();
      if (!access) return null;
      try {
        const { user } = await request<{ user: StoredUser }>('/auth/me');
        await tokenStore.setUser(user);
        return user;
      } catch {
        return cached;
      }
    },

    async forgotPassword(email: string) {
      await request('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email },
      });
    },

    async verifyOtp(email: string, code: string): Promise<{ resetToken: string }> {
      return request('/auth/verify-otp', {
        method: 'POST',
        auth: false,
        body: { email, code },
      });
    },

    async resetPassword(resetToken: string, password: string) {
      await request('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { resetToken, password },
      });
    },

    // Authenticated password change (user knows their current password).
    async changePassword(currentPassword: string, newPassword: string) {
      await request('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
    },
  },

  // ---------- Profile ----------
  profile: {
    get: (): Promise<Profile> => request('/profile'),
    update: (updates: Partial<Profile>): Promise<Profile> =>
      request('/profile', { method: 'PATCH', body: updates }),
  },

  // ---------- Categories ----------
  categories: {
    list: (): Promise<Category[]> => request('/categories'),
    create: (body: { name: string; icon?: string; color?: string }): Promise<Category> =>
      request('/categories', { method: 'POST', body }),
    update: (id: string, body: Partial<Category>): Promise<Category> =>
      request(`/categories/${id}`, { method: 'PATCH', body }),
    remove: (id: string): Promise<void> =>
      request(`/categories/${id}`, { method: 'DELETE' }),
  },

  // ---------- Transactions ----------
  transactions: {
    list: (filters: {
      from?: string;
      to?: string;
      type?: TransactionType;
      category_id?: string;
      limit?: number;
    } = {}): Promise<Transaction[]> => {
      const qs = new URLSearchParams(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return request(`/transactions${qs ? `?${qs}` : ''}`);
    },
    create: (body: {
      description: string;
      amount: number;
      type: TransactionType;
      date: string;
      category_id?: string | null;
      notes?: string | null;
      is_recurring?: boolean;
      client_id?: string;
    }): Promise<Transaction> => request('/transactions', { method: 'POST', body }),
    update: (id: string, body: Partial<Transaction>): Promise<Transaction> =>
      request(`/transactions/${id}`, { method: 'PATCH', body }),
    remove: (id: string): Promise<void> =>
      request(`/transactions/${id}`, { method: 'DELETE' }),
    bulk: (items: any[]): Promise<Transaction[]> =>
      request('/transactions/bulk', { method: 'POST', body: { items } }),
  },

  // ---------- Budgets ----------
  budgets: {
    list: (params: { month?: number; year?: number } = {}): Promise<Budget[]> => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return request(`/budgets${qs ? `?${qs}` : ''}`);
    },
    create: (body: {
      category_id: string;
      limit_amount: number;
      month: number;
      year: number;
      alert_at_percent?: number;
    }): Promise<Budget> => request('/budgets', { method: 'POST', body }),
    update: (id: string, body: Partial<Budget>): Promise<Budget> =>
      request(`/budgets/${id}`, { method: 'PATCH', body }),
    remove: (id: string): Promise<void> =>
      request(`/budgets/${id}`, { method: 'DELETE' }),
  },

  // ---------- Summary ----------
  summary: {
    monthly: (params: { month?: number; year?: number } = {}): Promise<MonthlySummary> => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return request(`/summary/monthly${qs ? `?${qs}` : ''}`);
    },
    categories: (params: { month?: number; year?: number } = {}): Promise<
      Array<{ category_id: string; name: string; icon: string; color: string; total_spent: number }>
    > => {
      const qs = new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString();
      return request(`/summary/categories${qs ? `?${qs}` : ''}`);
    },
  },
};

export { ApiError };
