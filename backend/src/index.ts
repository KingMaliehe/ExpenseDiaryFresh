// Entry point for the Expense Diary SA backend.
// Routes are mounted from src/routes/ — kept lean here on purpose.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env, isProd } from './lib/env';
import { prisma } from './lib/prisma';
import authRouter from './routes/auth';
import categoriesRouter from './routes/categories';
import transactionsRouter from './routes/transactions';
import budgetsRouter from './routes/budgets';
import profileRouter from './routes/profile';
import summaryRouter from './routes/summary';

const app = express();

// Behind Railway/Render/Fly the app sits behind a reverse proxy; trust the
// first X-Forwarded-For hop so express-rate-limit keys on the real client IP.
app.set('trust proxy', 1);

// --- Middleware ---
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));

// --- Health check ---
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Confirm DB reachable so health = "really healthy", not just "process alive".
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'ok', env: env.nodeEnv });
  } catch (err: any) {
    res.status(500).json({ ok: false, db: 'down', error: err?.message ?? 'unknown' });
  }
});

// --- Routes ---
app.use('/auth', authRouter);
app.use('/categories', categoriesRouter);
app.use('/transactions', transactionsRouter);
app.use('/budgets', budgetsRouter);
app.use('/profile', profileRouter);
app.use('/summary', summaryRouter);

// --- 404 handler ---
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'not_found', path: req.path });
});

// --- Error handler (must have 4 args for Express to recognize it) ---
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (!isProd) console.error(err);
  const status = typeof err?.status === 'number' ? err.status : 500;
  res.status(status).json({
    error: err?.code ?? 'server_error',
    message: err?.message ?? 'Something went wrong',
  });
});

const server = app.listen(env.port, () => {
  console.log(`[expense-diary] listening on http://localhost:${env.port}`);
});

// Graceful shutdown so dev reloads don't leak DB connections.
async function shutdown() {
  console.log('[expense-diary] shutting down');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
