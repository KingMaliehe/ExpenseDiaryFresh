// Single Prisma client instance, reused across requests.
// In dev, ts-node-dev hot-reloads; we attach to globalThis to avoid spawning
// a new client (and a new connection pool) on every reload.
import { PrismaClient } from '@prisma/client';
import { isProd } from './env';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['query', 'warn', 'error'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
