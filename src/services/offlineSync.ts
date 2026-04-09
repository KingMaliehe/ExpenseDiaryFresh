// src/services/offlineSync.ts
// Handles offline-first data using AsyncStorage as a local queue.
// When online, flushes queued writes to Supabase.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'offline_queue';

interface QueuedOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

async function isOnline(): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com', { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export async function queueOperation(op: Omit<QueuedOperation, 'id' | 'timestamp'>) {
  const queue = await getQueue();
  const newOp: QueuedOperation = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  };
  queue.push(newOp);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

async function getQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;
  const failedOps: QueuedOperation[] = [];

  for (const op of queue) {
    try {
      if (op.operation === 'insert') {
        const { error } = await supabase.from(op.table as any).insert(op.payload);
        if (error) throw error;
      } else if (op.operation === 'update') {
        const { error } = await supabase.from(op.table as any).update(op.payload).eq('id', op.payload.id);
        if (error) throw error;
      } else if (op.operation === 'delete') {
        const { error } = await supabase.from(op.table as any).delete().eq('id', op.payload.id);
        if (error) throw error;
      }
      synced++;
    } catch (e) {
      console.warn('Failed to sync operation:', op.id, e);
      failedOps.push(op);
      failed++;
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(failedOps));
  return { synced, failed };
}
