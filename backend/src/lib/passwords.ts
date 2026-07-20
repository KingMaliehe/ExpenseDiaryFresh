// Password hashing. bcrypt is intentionally slow (cost 12 ≈ 250ms) to make
// brute-forcing leaked hashes painful. Don't lower the cost unless you have
// load issues — and even then, profile first.
import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
