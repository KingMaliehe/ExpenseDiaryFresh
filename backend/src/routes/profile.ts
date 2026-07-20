// Profile = the user's display data (name, avatar, currency, monthly_income).
// Auto-created on signup, so GET should always succeed for any logged-in user.
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { serializeProfile } from '../lib/serialize';

const router = Router();
router.use(requireAuth);

const updateBody = z.object({
  full_name: z.string().max(120).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  currency: z.string().length(3).optional(),
  monthly_income: z.number().min(0).optional(),
});

// GET /profile
router.get('/', async (req: Request, res: Response) => {
  const profile = await prisma.profile.findUnique({ where: { id: req.auth!.userId } });
  if (!profile) return res.status(404).json({ error: 'profile_not_found' });
  res.json(serializeProfile(profile));
});

// PATCH /profile
router.patch('/', async (req: Request, res: Response) => {
  const parsed = updateBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const data: any = {};
  if (parsed.data.full_name !== undefined) data.fullName = parsed.data.full_name;
  if (parsed.data.avatar_url !== undefined) data.avatarUrl = parsed.data.avatar_url;
  if (parsed.data.currency !== undefined) data.currency = parsed.data.currency;
  if (parsed.data.monthly_income !== undefined) data.monthlyIncome = parsed.data.monthly_income;

  const updated = await prisma.profile.update({
    where: { id: req.auth!.userId },
    data,
  });
  res.json(serializeProfile(updated));
});

export default router;
