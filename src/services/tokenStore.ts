// Secure storage for JWT tokens and the cached user record.
// JWTs from our backend are well under SecureStore's 2KB limit so no chunking
// is needed (unlike Supabase's session blobs).
//
// Platform note: expo-secure-store is native-only — it has no web backend, so
// calling it in a browser throws "getValueWithKeyAsync is not a function".
// On web we fall back to localStorage (fine for local dev / PWA use). The
// `storage` adapter below hides that split behind one async get/set/delete API.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS = 'ed_access_token';
const KEY_REFRESH = 'ed_refresh_token';
const KEY_USER = 'ed_user';

type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const webStorage: Storage = {
  async getItem(key) {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  },
  async setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode / storage disabled — ignore */
    }
  },
  async removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

const nativeStorage: Storage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const storage: Storage = Platform.OS === 'web' ? webStorage : nativeStorage;

export type StoredUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return storage.getItem(KEY_ACCESS);
  },
  async getRefresh(): Promise<string | null> {
    return storage.getItem(KEY_REFRESH);
  },
  async getUser(): Promise<StoredUser | null> {
    const raw = await storage.getItem(KEY_USER);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    await storage.setItem(KEY_ACCESS, access);
    await storage.setItem(KEY_REFRESH, refresh);
  },
  async setUser(user: StoredUser): Promise<void> {
    await storage.setItem(KEY_USER, JSON.stringify(user));
  },
  async clear(): Promise<void> {
    await storage.removeItem(KEY_ACCESS);
    await storage.removeItem(KEY_REFRESH);
    await storage.removeItem(KEY_USER);
  },
};
