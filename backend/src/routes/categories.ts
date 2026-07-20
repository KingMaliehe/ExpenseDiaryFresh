// Categories CRUD. Every endpoint scopes by req.auth.userId so users only see
// their own rows — this is the application-level equivalent of Supabase RLS.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { serializeCategory } from '../lib/serialize';

const router = Router();
router.use(requireAuth);

const upsertBody = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

// GET /categories
router.get('/', async (req: Request, res: Response) => {
  const rows = await prisma.category.findMany({
    where: { userId: req.auth!.userId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  res.json(rows.map(serializeCategory));
});

// POST /categories
router.post('/', async (req: Request, res: Response) => {
  const parsed = upsertBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const created = await prisma.category.create({
    data: {
      userId: req.auth!.userId,
      name: parsed.data.name,
      icon: parsed.data.icon ?? '📌',
      color: parsed.data.color ?? '#8b949e',
      isDefault: false,
    },
  });
  res.status(201).json(serializeCategory(created));
});

// PATCH /categories/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const parsed = upsertBody.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  // updateMany with the userId guard guarantees the user can't edit someone
  // else's row even if they guess a valid id.
  const result = await prisma.category.updateMany({
    where: { id: req.params.id, userId: req.auth!.userId },
    data: parsed.data,
  });
  if (result.count === 0) return res.status(404).json({ error: 'not_found' });

  const updated = await prisma.category.findUnique({ where: { id: req.params.id } });
  res.json(serializeCategory(updated!));
});

// DELETE /categories/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const result = await prisma.category.deleteMany({
    where: { id: req.params.id, userId: req.auth!.userId },
  });
  if (result.count === 0) return res.status(404).json({ error: 'not_found' });
  res.status(204).end();
});

export default router;
