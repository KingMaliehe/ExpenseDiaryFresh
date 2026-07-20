// Converts Prisma's camelCase models into the snake_case shape the app
// already expects (matches src/types/database.ts in the Expo project).
// Doing this here keeps the Phase 5 app rewrite to "swap supabase client",
// not "rename every field everywhere".
import type { Profile, Category, Transaction, Budget } from '@prisma/client';

type CategoryWith = Category & { user_id?: string };

export function serializeProfile(p: Profile) {
  return {
    id: p.id,
    full_name: p.fullName,
    avatar_url: p.avatarUrl,
    currency: p.currency,
    monthly_income: Number(p.monthlyIncome),
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  };
}

export function serializeCategory(c: Category) {
  return {
    id: c.id,
    user_id: c.userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    is_default: c.isDefault,
    created_at: c.createdAt.toISOString(),
  };
}

export function serializeTransaction(t: Transaction & { category?: Category | null }) {
  return {
    id: t.id,
    user_id: t.userId,
    category_id: t.categoryId,
    description: t.description,
    amount: Number(t.amount),
    type: t.type,
    // Postgres `date` comes back as a JS Date pinned to midnight UTC — we want
    // just the YYYY-MM-DD string to match Supabase's behaviour.
    date: t.date.toISOString().slice(0, 10),
    notes: t.notes,
    is_recurring: t.isRecurring,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
    client_id: t.clientId,
    synced_at: t.syncedAt ? t.syncedAt.toISOString() : null,
    category: t.category ? serializeCategory(t.category) : undefined,
  };
}

export function serializeBudget(
  b: Budget & { category?: Category | null; spent?: number },
) {
  return {
    id: b.id,
    user_id: b.userId,
    category_id: b.categoryId,
    limit_amount: Number(b.limitAmount),
    month: b.month,
    year: b.year,
    alert_at_percent: b.alertAtPercent,
    created_at: b.createdAt.toISOString(),
    category: b.category ? serializeCategory(b.category) : undefined,
    spent: b.spent,
  };
}
