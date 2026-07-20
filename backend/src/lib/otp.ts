// One-time password helpers. 8-digit codes to match the app's existing UI.
//
// Codes are stored bcrypt-hashed — same reason we hash passwords: a DB leak
// shouldn't hand attackers a working OTP. Brute force is impractical because
// rows expire fast and we rate-limit verify attempts at the route layer.
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const OTP_LENGTH = 8;
const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function generateOtp(): string {
  // 8 random digits. crypto.randomInt gives uniform distribution.
  let code = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += crypto.randomInt(0, 10).toString();
  }
  return code;
}

export function otpExpiry(): Date {
  return new Date(Date.now() + OTP_TTL_MS);
}

export async function hashOtp(code: string): Promise<string> {
  // Cost 10 instead of 12 — OTPs are 8 digits and live 15 min, so the
  // extra cost buys very little vs. login passwords.
  return bcrypt.hash(code, 10);
}

export async function verifyOtp(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
