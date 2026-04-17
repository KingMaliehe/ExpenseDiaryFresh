// src/services/supabase.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Database } from "../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2048 byte limit per value.
// Supabase session tokens exceed this, so we chunk large values into SecureStore
// and fall back to AsyncStorage for anything that doesn't fit.
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkCount) {
        // Reassemble chunked value
        const chunks: string[] = [];
        for (let i = 0; i < parseInt(chunkCount); i++) {
          const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
          if (chunk) chunks.push(chunk);
        }
        return chunks.join("");
      }
      return await SecureStore.getItemAsync(key);
    } catch {
      return AsyncStorage.getItem(key);
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (value.length <= 2000) {
        await SecureStore.setItemAsync(key, value);
      } else {
        // Chunk into 2000-byte pieces
        const chunks = value.match(/.{1,2000}/g) ?? [];
        await SecureStore.setItemAsync(`${key}_chunks`, String(chunks.length));
        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
        }
      }
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      const chunkCount = await SecureStore.getItemAsync(`${key}_chunks`);
      if (chunkCount) {
        for (let i = 0; i < parseInt(chunkCount); i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
        await SecureStore.deleteItemAsync(`${key}_chunks`);
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      await AsyncStorage.removeItem(key);
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE flow returns tokens as ?code=... query params (not #fragments),
    // which survive Android's Chrome → app intent handoff for deep links.
    flowType: "pkce",
  },
});
