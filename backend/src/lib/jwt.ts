// JWT signing & verification using jose (modern, audited, no native deps).
//
// Two token types:
//   - access  : short-lived (15min), sent on every API call as Bearer token
//   - refresh : long-lived (30 days), only sent to /auth/refresh to mint a new access token
//
// Refresh tokens are ALSO stored hashed in the refresh_tokens table so we can
// revoke them on signout or compromise.
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { env } from './env';

const accessSecret = new TextEncoder().encode(env.jwtAccessSecret);
const refreshSecret = new TextEncoder().encode(env.jwtRefreshSecret);

export type AccessTokenPayload = {
  sub: string; // userId
  email: string;
};

export type RefreshTokenPayload = {
  sub: string;
  tid: string; // refresh token id — used to find it in the DB
};

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.jwtAccessTtl}s`)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret);
  return { sub: payload.sub as string, email: payload.email as string };
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ tid: payload.tid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.jwtRefreshTtl}s`)
    .sign(refreshSecret);
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return { sub: payload.sub as string, tid: payload.tid as string };
}

// We store SHA-256 of the refresh JWT in the DB. That way a DB leak doesn't
// give the attacker a working token, but we can still look up & revoke.
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
