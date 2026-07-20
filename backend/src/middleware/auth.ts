// Express middleware. Pulls the Bearer token off the Authorization header,
// verifies it, and attaches { userId, email } to req.auth so downstream
// handlers can use it without re-parsing.
//
// Usage:
//   router.get('/me', requireAuth, (req, res) => {
//     res.json({ userId: req.auth!.userId });
//   });
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: { userId: string; email: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = await verifyAccessToken(token);
    req.auth = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
