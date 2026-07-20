// src/services/offlineSync.ts
// Offline-first queue. While the device is offline (or the server is down),
// writes are pushed onto a local AsyncStorage queue. When connectivity comes
// back, syncOfflineQueue() flushes them via the new backend API.
//
// What changed from the Supabase version:
//   - flush uses api.transactions.bulk (which is server-side idempotent via
//     client_id, so duplicate retries don't create duplicate rows)
//   - update/delete still go through individual calls — those don't need
//     dedup because they're keyed by id
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './apiClient';

const QUEUE_KEY = 'offline_queue_v2';

type Table = 'transactions' | 'budgets';

interface QueuedOperation {
  id: string;
  table: Table;
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  timestamp: number;
}

async function isOnline(): Promise<boolean> {
  // Cheap reachability probe — replace later with a NetInfo subscription
  // if we want push-style sync triggers.
  try {
    const res = await fetch('https://www.google.com', { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function getQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedOperation[]) : [];
  } catch {
    return [];
  }
}

async function setQueue(q: QueuedOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function queueOperation(
  op: Omit<QueuedOperation, 'id' | 'timestamp'>,
): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  });
  await setQueue(queue);
}

export async function syncOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (!(await isOnline())) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  // Batch all the transaction inserts together — one network roundtrip rather
  // than N. The server's client_id dedup makes this safe even on retry.
  const txInserts = queue.filter((q) => q.table === 'transactions' && q.operation === 'insert');
  const others = queue.filter((q) => !(q.table === 'transactions' && q.operation === 'insert'));

  let synced = 0;
  let failed = 0;
  const failedOps: QueuedOperation[] = [];

  if (txInserts.length > 0) {
    try {
      await api.transactions.bulk(txInserts.map((q) => q.payload));
      synced += txInserts.length;
    } catch (e) {
      console.warn('Bulk transaction sync failed:', e);
      failedOps.push(...txInserts);
      failed += txInserts.length;
    }
  }

  for (const op of others) {
    try {
      await runOne(op);
      synced++;
    } catch (e) {
      // 4xx = bad data, won't fix itself. Drop it so we don't retry forever.
      // 5xx / network = retry later.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        console.warn('Dropping bad queued op:', op.id, e.message);
      } else {
        failedOps.push(op);
        failed++;
      }
    }
  }

  await setQueue(failedOps);
  return { synced, failed };
}

async function runOne(op: QueuedOperation): Promise<void> {
  if (op.table === 'transactions') {
    if (op.operation === 'update') {
      await api.transactions.update(op.payload.id, op.payload);
    } else if (op.operation === 'delete') {
      await api.transactions.remove(op.payload.id);
    } else {
      // Single inserts get the same dedup; safe to retry.
      await api.transactions.create(op.payload);
    }
  } else if (op.table === 'budgets') {
    if (op.operation === 'insert') await api.budgets.create(op.payload);
    if (op.operation === 'update') await api.budgets.update(op.payload.id, op.payload);
    if (op.operation === 'delete') await api.budgets.remove(op.payload.id);
  }
}
