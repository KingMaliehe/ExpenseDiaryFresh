// Replaces Supabase's monthly_summary and category_spending SQL views.
// These are read-only aggregates the dashboard uses; computing them here keeps
// the schema simple (no views to maintain in migrations).
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

const monthQuery = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

// GET /summary/monthly?month=&year=
// Returns { total_income, total_expenses, net_savings } for the given month,
// or for the current month if month/year are omitted.
router.get('/monthly', async (req: Request, res: Response) => {
  const parsed = monthQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' });

  const now = new Date();
  const month = parsed.data.month ?? now.getUTCMonth() + 1;
  const year = parsed.data.year ?? now.getUTCFullYear();

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const agg = await prisma.transaction.groupBy({
    by: ['type'],
    where: { userId: req.auth!.userId, date: { gte: start, lt: end } },
    _sum: { amount: true },
  });

  let income = 0;
  let expenses = 0;
  for (const row of agg) {
    if (row.type === 'income') income = Number(row._sum.amount ?? 0);
    if (row.type === 'expense') expenses = Number(row._sum.amount ?? 0);
  }

  res.json({
    month: `${year}-${String(month).padStart(2, '0')}-01`,
    total_income: income,
    total_expenses: expenses,
    net_savings: income - expenses,
  });
});

// GET /summary/categories?month=&year=
// Returns array of { category_id, name, icon, color, total_spent } — expense
// breakdown for the dashboard pie chart.
router.get('/categories', async (req: Request, res: Response) => {
  const parsed = monthQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_query' });

  const now = new Date();
  const month = parsed.data.month ?? now.getUTCMonth() + 1;
  const year = parsed.data.year ?? now.getUTCFullYear();

  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  const grouped = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      userId: req.auth!.userId,
      type: 'expense',
      date: { gte: start, lt: end },
      categoryId: { not: null },
    },
    _sum: { amount: true },
  });

  const cats = await prisma.category.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId!).filter(Boolean) } },
  });
  const catMap = new Map(cats.map((c) => [c.id, c]));

  const out = grouped
    .filter((g) => g.categoryId && catMap.has(g.categoryId))
    .map((g) => {
      const c = catMap.get(g.categoryId!)!;
      return {
        category_id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        total_spent: Number(g._sum.amount ?? 0),
      };
    })
    .sort((a, b) => b.total_spent - a.total_spent);

  res.json(out);
});

export default router;
