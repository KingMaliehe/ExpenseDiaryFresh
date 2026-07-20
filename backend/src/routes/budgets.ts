// Budgets CRUD. List endpoint also computes `spent` for the month/year by
// summing transactions in that category — that's a UI convenience the old
// app derived in code; we move it server-side so the app stays simple.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { serializeBudget } from '../lib/serialize';

const router = Router();
router.use(requireAuth);

const upsertBody = z.object({
  category_id: z.string().uuid(),
  limit_amount: z.number().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  alert_at_percent: z.number().int().min(1).max(100).optional(),
});

// GET /budgets?month=&year=
router.get('/', async (req: Request, res: Response) => {
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;

  const budgets = await prisma.budget.findMany({
    where: {
      userId: req.auth!.userId,
      ...(month ? { month } : {}),
      ...(year ? { year } : {}),
    },
    include: { category: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  // For each budget, sum the relevant expense transactions in one query.
  // (Doing it per-budget would be N+1; this is a single grouped query.)
  const spent = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId: req.auth!.userId,
      type: 'expense',
      categoryId: { in: budgets.map((b) => b.categoryId) },
      ...(month && year
        ? {
            date: {
              gte: new Date(Date.UTC(year, month - 1, 1)),
              lt: new Date(Date.UTC(year, month, 1)),
            },
          }
        : {}),
    },
    _sum: { amount: true },
  });
  const spentMap = new Map(spent.map((s) => [s.categoryId!, Number(s._sum.amount ?? 0)]));

  res.json(
    budgets.map((b) =>
      serializeBudget({ ...b, spent: spentMap.get(b.categoryId) ?? 0 }),
    ),
  );
});

// POST /budgets
router.post('/', async (req: Request, res: Response) => {
  const parsed = upsertBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  try {
    const created = await prisma.budget.create({
      data: {
        userId: req.auth!.userId,
        categoryId: parsed.data.category_id,
        limitAmount: parsed.data.limit_amount,
        month: parsed.data.month,
        year: parsed.data.year,
        alertAtPercent: parsed.data.alert_at_percent ?? 80,
      },
      include: { category: true },
    });
    res.status(201).json(serializeBudget(created));
  } catch (e: any) {
    if (e?.code === 'P2002') {
      // Unique violation on (user_id, category_id, month, year)
      return res.status(409).json({ error: 'budget_exists' });
    }
    throw e;
  }
});

// PATCH /budgets/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = upsertBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const data: any = {};
  if (parsed.data.limit_amount !== undefined) data.limitAmount = parsed.data.limit_amount;
  if (parsed.data.alert_at_percent !== undefined) data.alertAtPercent = parsed.data.alert_at_percent;
  if (parsed.data.month !== undefined) data.month = parsed.data.month;
  if (parsed.data.year !== undefined) data.year = parsed.data.year;
  if (parsed.data.category_id !== undefined) data.categoryId = parsed.data.category_id;

  const result = await prisma.budget.updateMany({
    where: { id: req.params.id, userId: req.auth!.userId },
    data,
  });
  if (result.count === 0) return res.status(404).json({ error: 'not_found' });

  const updated = await prisma.budget.findUnique({
    where: { id: req.params.id },
    include: { category: true },
  });
  res.json(serializeBudget(updated!));
});

// DELETE /budgets/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const result = await prisma.budget.deleteMany({
    where: { id: req.params.id, userId: req.auth!.userId },
  });
  if (result.count === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

export default router;
