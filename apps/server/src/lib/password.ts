import bcrypt from "bcryptjs";

const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;
const SALT_ROUNDS = 12;

export function isPasswordHash(password: string | null | undefined): boolean {
  return typeof password === "string" && BCRYPT_PREFIX.test(password);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  storedPassword: string | null | undefined,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedPassword) return { valid: false, needsRehash: false };

  if (isPasswordHash(storedPassword)) {
    return { valid: await bcrypt.compare(password, storedPassword), needsRehash: false };
  }

  return {
    valid: storedPassword === password,
    needsRehash: storedPassword === password,
  };
}
