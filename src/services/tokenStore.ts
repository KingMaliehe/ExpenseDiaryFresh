// Secure storage for JWT tokens and the cached user record.
// JWTs from our backend are well under SecureStore's 2KB limit so no chunking
// is needed (unlike Supabase's session blobs).
import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS = 'ed_access_token';
const KEY_REFRESH = 'ed_refresh_token';
const KEY_USER = 'ed_user';

export type StoredUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export const tokenStore = {
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_ACCESS);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(KEY_REFRESH);
  },
  async getUser(): Promise<StoredUser | null> {
    const raw = await SecureStore.getItemAsync(KEY_USER);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    await SecureStore.setItemAsync(KEY_ACCESS, access);
    await SecureStore.setItemAsync(KEY_REFRESH, refresh);
  },
  async setUser(user: StoredUser): Promise<void> {
    await SecureStore.setItemAsync(KEY_USER, JSON.stringify(user));
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(KEY_ACCESS);
    await SecureStore.deleteItemAsync(KEY_REFRESH);
    await SecureStore.deleteItemAsync(KEY_USER);
  },
};
