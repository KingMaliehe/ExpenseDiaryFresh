// Centralized env parsing. Throws on startup if a required var is missing
// so we fail fast instead of getting confusing runtime errors.
import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== '' ? v : fallback;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  jwtAccessTtl: parseInt(optional('JWT_ACCESS_TTL', '900'), 10),
  jwtRefreshTtl: parseInt(optional('JWT_REFRESH_TTL', '2592000'), 10),
  resendApiKey: optional('RESEND_API_KEY', ''),
  resendFrom: optional('RESEND_FROM', 'Expense Diary <onboarding@resend.dev>'),
  port: parseInt(optional('PORT', '4000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigin: optional('CORS_ORIGIN', '*'),
};

export const isProd = env.nodeEnv === 'production';
