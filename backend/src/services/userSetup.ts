// Replicates Supabase's on_auth_user_created triggers in app code:
//   - creates the matching profiles row
//   - seeds the 11 default categories
//
// Called inside the same Prisma transaction as user creation so signup is
// fully atomic — either the whole graph is created or none of it is.
import type { Prisma } from '@prisma/client';

const DEFAULT_CATEGORIES = [
  { name: 'Housing',          icon: '🏠', color: '#58a6ff' },
  { name: 'Food & Groceries', icon: '🛒', color: '#bc8cff' },
  { name: 'Transport',        icon: '🚗', color: '#d4a843' },
  { name: 'Utilities',        icon: '⚡', color: '#3fb950' },
  { name: 'Entertainment',    icon: '📺', color: '#f0883e' },
  { name: 'Health',           icon: '🏥', color: '#ff7b72' },
  { name: 'Education',        icon: '📚', color: '#58a6ff' },
  { name: 'Clothing',         icon: '👕', color: '#bc8cff' },
  { name: 'Savings',          icon: '💰', color: '#3fb950' },
  { name: 'Income',           icon: '💼', color: '#3fb950' },
  { name: 'Other',            icon: '📌', color: '#8b949e' },
];

export async function seedNewUser(
  tx: Prisma.TransactionClient,
  userId: string,
  fullName?: string,
): Promise<void> {
  await tx.profile.create({
    data: { id: userId, fullName: fullName ?? null },
  });

  await tx.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      userId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      isDefault: true,
    })),
  });
}
