import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";

/* Auth tối giản — session ký HMAC trong cookie (gắn 6b.F guard + 6b.I signed cookie).
 * Stateless: token = base64url(payload).base64url(HMAC). Đổi 1 byte → verify fail. */

export interface Session {
  user: string;
  roles?: string[];
  [k: string]: unknown;
}

export function hasRole(session: Session | null, role: string): boolean {
  return !!session?.roles?.includes(role);
}

export function signSession(payload: Session, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
}

/* Password hashing — scrypt (built-in, memory-hard). Format: scrypt$salt$hash.
 * (Production: Argon2id qua `npm i argon2`; scrypt là chuẩn built-in, an toàn.) */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 32);
  const expected = Buffer.from(hashHex, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

/* CSRF token (double-submit cookie): cookie csrf + header x-csrf-token phải khớp. */
export function newCsrfToken(): string {
  return randomBytes(24).toString("hex");
}

export function parseCookie(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
