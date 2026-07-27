// Auth endpoints. Mirrors the Supabase auth API surface our app already uses,
// so the app-side rewrite in Phase 5 stays small.
//
//   POST /auth/signup    { email, password, fullName? }     → { user, accessToken, refreshToken }
//   POST /auth/signin    { email, password }                → { user, accessToken, refreshToken }
//   POST /auth/refresh   { refreshToken }                   → { accessToken, refreshToken }   (rotates)
//   POST /auth/signout   { refreshToken }                   → 204
//   GET  /auth/me        (Bearer)                           → { user }
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { hashPassword, verifyPassword } from '../lib/passwords';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from '../lib/jwt';
import { requireAuth } from '../middleware/auth';
import { seedNewUser } from '../services/userSetup';
import { generateOtp, otpExpiry, hashOtp, verifyOtp } from '../lib/otp';
import { sendEmail, renderOtpEmail } from '../lib/email';
import crypto from 'crypto';

// Reset tokens — short-lived (10min) JWT issued after OTP verification,
// scoped to a single user, used only by /auth/reset-password.
const resetSecret = new TextEncoder().encode(env.jwtAccessSecret + ':reset');
const RESET_TTL_S = 600;

async function signResetToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: 'password_reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${RESET_TTL_S}s`)
    .sign(resetSecret);
}

async function verifyResetToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, resetSecret);
  if (payload.purpose !== 'password_reset') throw new Error('wrong_purpose');
  return payload.sub as string;
}

const router = Router();

// Brute-force defence: 10 signin attempts per IP per 15 min. Generous enough
// that fat-fingering won't lock real users out, tight enough to deter scripts.
const signinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

const signupBody = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  fullName: z.string().max(120).optional(),
});

const signinBody = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

// Shape returned to the client. Never include passwordHash.
type PublicUser = { id: string; email: string; fullName: string | null };

async function issueTokenPair(userId: string, email: string) {
  const tid = crypto.randomUUID();
  const accessToken = await signAccessToken({ sub: userId, email });
  const refreshToken = await signRefreshToken({ sub: userId, tid });

  await prisma.refreshToken.create({
    data: {
      id: tid,
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + env.jwtRefreshTtl * 1000),
    },
  });

  return { accessToken, refreshToken };
}

// =====================================================================
// POST /auth/signup
// =====================================================================
router.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', issues: parsed.error.issues });
  }
  const { email, password, fullName } = parsed.data;
  const normEmail = email.trim().toLowerCase();

  // Surface "already registered" cleanly so the app can show a useful message.
  const existing = await prisma.user.findUnique({ where: { email: normEmail } });
  if (existing) {
    return res.status(409).json({ error: 'email_taken' });
  }

  const passwordHash = await hashPassword(password);

  // One transaction: user + profile + seeded categories. If any fails, nothing
  // is left behind in a partial state.
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email: normEmail, passwordHash },
    });
    await seedNewUser(tx, created.id, fullName);
    return created;
  });

  const tokens = await issueTokenPair(user.id, user.email);
  const publicUser: PublicUser = { id: user.id, email: user.email, fullName: fullName ?? null };
  res.status(201).json({ user: publicUser, ...tokens });
});

// =====================================================================
// POST /auth/signin
// =====================================================================
router.post('/signin', signinLimiter, async (req: Request, res: Response) => {
  const parsed = signinBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body' });
  }
  const { email, password } = parsed.data;
  const normEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normEmail },
    include: { profile: true },
  });

  // Same response for "no user" and "wrong password" — don't leak which emails
  // are registered.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const tokens = await issueTokenPair(user.id, user.email);
  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    fullName: user.profile?.fullName ?? null,
  };
  res.json({ user: publicUser, ...tokens });
});

// =====================================================================
// POST /auth/refresh   (rotates the refresh token — old one is revoked)
// =====================================================================
router.post('/refresh', async (req: Request, res: Response) => {
  const parsed = refreshBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body' });
  }

  let payload;
  try {
    payload = await verifyRefreshToken(parsed.data.refreshToken);
  } catch {
    return res.status(401).json({ error: 'invalid_refresh' });
  }

  const stored = await prisma.refreshToken.findUnique({ where: { id: payload.tid } });
  if (
    !stored ||
    stored.revokedAt ||
    stored.expiresAt < new Date() ||
    stored.tokenHash !== hashToken(parsed.data.refreshToken)
  ) {
    return res.status(401).json({ error: 'invalid_refresh' });
  }

  // Revoke the old token and issue a fresh pair. This is the rotation pattern:
  // each refresh token can only be used once.
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) return res.status(401).json({ error: 'invalid_refresh' });

  const tokens = await issueTokenPair(user.id, user.email);
  res.json(tokens);
});

// =====================================================================
// POST /auth/signout
// =====================================================================
router.post('/signout', async (req: Request, res: Response) => {
  const parsed = refreshBody.safeParse(req.body);
  // Be lenient on signout — if they don't send us a refresh token, the client
  // is already in a "logged out" state, so just succeed.
  if (!parsed.success) return res.status(204).end();

  try {
    const payload = await verifyRefreshToken(parsed.data.refreshToken);
    await prisma.refreshToken.updateMany({
      where: { id: payload.tid, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Token invalid/expired — nothing to revoke, signout is still a success.
  }
  res.status(204).end();
});

// =====================================================================
// PASSWORD RESET FLOW
// Three steps, each rate-limited at different windows.
//   1. /forgot-password  → email user a code (always 204 even if no user)
//   2. /verify-otp       → exchange code for a short-lived reset token
//   3. /reset-password   → use the reset token to set a new password
// =====================================================================

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5, // 5 reset requests per IP per hour — prevents inbox spam
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15min — generous for typos, tight for brute force
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

const forgotBody = z.object({ email: z.string().email().max(255) });
const verifyOtpBody = z.object({
  email: z.string().email().max(255),
  code: z.string().regex(/^\d{8}$/),
});
const resetBody = z.object({
  resetToken: z.string().min(10),
  password: z.string().min(6).max(128),
});

// POST /auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response) => {
  const parsed = forgotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });
  const email = parsed.data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return 204 — don't reveal which emails are registered. We still
  // do the work (generate + send) only when the user actually exists.
  if (user) {
    // Invalidate any previous unconsumed reset codes for this user.
    await prisma.otpCode.updateMany({
      where: { userId: user.id, purpose: 'password_reset', consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtp();
    const codeHash = await hashOtp(code);

    await prisma.otpCode.create({
      data: {
        userId: user.id,
        codeHash,
        purpose: 'password_reset',
        expiresAt: otpExpiry(),
      },
    });

    const email_ = renderOtpEmail(code);
    try {
      await sendEmail({ to: email, ...email_ });
    } catch (err) {
      console.error('Failed to send OTP email:', err);
      // Still return 204 — the user can try again. Don't expose email errors.
    }
  }

  res.status(204).end();
});

// POST /auth/verify-otp
router.post('/verify-otp', verifyLimiter, async (req: Request, res: Response) => {
  const parsed = verifyOtpBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });
  const email = parsed.data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(400).json({ error: 'invalid_code' });

  // Most recent unconsumed, unexpired code for this user/purpose.
  const otp = await prisma.otpCode.findFirst({
    where: {
      userId: user.id,
      purpose: 'password_reset',
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return res.status(400).json({ error: 'invalid_code' });

  const ok = await verifyOtp(parsed.data.code, otp.codeHash);
  if (!ok) return res.status(400).json({ error: 'invalid_code' });

  // Mark consumed and hand back a reset token.
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  const resetToken = await signResetToken(user.id);
  res.json({ resetToken });
});

// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  const parsed = resetBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  let userId: string;
  try {
    userId = await verifyResetToken(parsed.data.resetToken);
  } catch {
    return res.status(401).json({ error: 'invalid_reset_token' });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  // Update password AND revoke all existing refresh tokens — forces every
  // device to re-login with the new credentials.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  res.status(204).end();
});

// =====================================================================
// POST /auth/change-password   (authenticated — for a logged-in user)
// Verifies the current password before setting a new one. Distinct from the
// forgot-password OTP flow, which is for users who can't sign in.
// =====================================================================
const changePasswordBody = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
});

router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  const parsed = changePasswordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_body' });

  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: 'user_not_found' });

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return res.status(400).json({ error: 'same_password' });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Keep the current session valid (user stays logged in on this device).
  res.status(204).end();
});

// =====================================================================
// GET /auth/me
// =====================================================================
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { profile: true },
  });
  if (!user) return res.status(404).json({ error: 'user_not_found' });
  const publicUser: PublicUser = {
    id: user.id,
    email: user.email,
    fullName: user.profile?.fullName ?? null,
  };
  res.json({ user: publicUser });
});

export default router;
