// Transactions CRUD. The interesting bits are the optional filters on list
// and the client_id handling on create — that's how the app's offline queue
// avoids creating duplicates when it flushes.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { serializeTransaction } from '../lib/serialize';

const router = Router();
router.use(requireAuth);

// Helper: 'YYYY-MM-DD' → Date at midnight UTC. Matches Postgres `date` column.
function parseDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

const upsertBody = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  type: z.enum(['income', 'expense']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  is_recurring: z.boolean().optional(),
  client_id: z.string().min(1).max(64).optional(),
});

const listQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  type: z.enum(['income', 'expense']).optional(),
  category_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

// GET /transactions?from=&to=&type=&category_id=&limit=
router.get('/', async (req: Request, res: Response) => {
  const parsed = listQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' });
  const { from, to, type, category_id, limit } = parsed.data;

  const rows = await prisma.transaction.findMany({
    where: {
      userId: req.auth!.userId,
      ...(type ? { type } : {}),
      ...(category_id ? { categoryId: category_id } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: parseDate(from) } : {}),
              ...(to ? { lte: parseDate(to) } : {}),
            },
          }
        : {}),
    },
    include: { category: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: limit ?? 200,
  });
  res.json(rows.map(serializeTransaction));
});

// POST /transactions
// If client_id is provided and we've already saved a transaction with that
// client_id, return the existing one instead of creating a duplicate. This is
// what makes the offline queue safe to retry.
router.post('/', async (req: Request, res: Response) => {
  const parsed = upsertBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
  }
  const { client_id } = parsed.data;

  if (client_id) {
    const existing = await prisma.transaction.findUnique({
      where: { clientId: client_id },
      include: { category: true },
    });
    if (existing && existing.userId === req.auth!.userId) {
      return res.status(200).json(serializeTransaction(existing));
    }
  }

  const created = await prisma.transaction.create({
    data: {
      userId: req.auth!.userId,
      description: parsed.data.description,
      amount: parsed.data.amount,
      type: parsed.data.type,
      date: parseDate(parsed.data.date),
      categoryId: parsed.data.category_id ?? null,
      notes: parsed.data.notes ?? null,
      isRecurring: parsed.data.is_recurring ?? false,
      clientId: client_id ?? null,
      syncedAt: new Date(),
    },
    include: { category: true },
  });
  res.status(201).json(serializeTransaction(created));
});

// PATCH /transactions/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = upsertBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const data: any = { ...parsed.data };
  if (data.date) data.date = parseDate(data.date);
  if (data.category_id !== undefined) {
    data.categoryId = data.category_id;
    delete data.category_id;
  }
  if (data.is_recurring !== undefined) {
    data.isRecurring = data.is_recurring;
    delete data.is_recurring;
  }
  delete data.client_id; // client_id is immutable once set

  const result = await prisma.transaction.updateMany({
    where: { id: req.params.id, userId: req.auth!.userId },
    data,
  });
  if (result.count === 0) return res.status(404).json({ error: 'not_found' });

  const updated = await prisma.transaction.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  });
  res.json(serializeTransaction(updated!));
});

// DELETE /transactions/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const result = await prisma.transaction.deleteMany({
    where: { id: req.params.id, userId: req.auth!.userId },
  });
  if (result.count === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

// POST /transactions/bulk
// Used by the offline sync flush. Accepts an array, processes each one with
// the same client_id dedup logic. Returns all the resulting rows in order.
const bulkBody = z.object({ items: z.array(upsertBody).max(200) });

router.post('/bulk', async (req: Request, res: Response) => {
  const parsed = bulkBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const results = [];
  for (const item of parsed.data.items) {
    if (item.client_id) {
      const existing = await prisma.transaction.findUnique({
        where: { clientId: item.client_id },
        include: { category: true },
      });
      if (existing && existing.userId === req.auth!.userId) {
        results.push(serializeTransaction(existing));
        continue;
      }
    }
    const created = await prisma.transaction.create({
      data: {
        userId: req.auth!.userId,
        description: item.description,
        amount: item.amount,
        type: item.type,
        date: parseDate(item.date),
        categoryId: item.category_id ?? null,
        notes: item.notes ?? null,
        isRecurring: item.is_recurring ?? false,
        clientId: item.client_id ?? null,
        syncedAt: new Date(),
      },
      include: { category: true },
    });
    results.push(serializeTransaction(created));
  }
  res.json(results);
});

export default router;
