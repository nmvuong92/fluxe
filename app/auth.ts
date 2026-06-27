// AUTH của bạn — wire provider (better-auth/lucia/passport) qua bridgeSession.
// Demo: đọc session giả từ cookie `demo` (KHÔNG phải auth thật). App thật thay bằng provider:
//   bridgeSession((req) => betterAuth.api.getSession({ headers: req.headers }))
import { bridgeSession } from "../src/auth";   // published: @nmvuong92/fluxe/auth
import { parseCookie } from "../src/core/cookie";

export interface AppSession { user: string; roles: string[] }

export const sessionMw = bridgeSession((req): AppSession | null => {
  const c = parseCookie(req.headers.cookie);
  return c.demo ? { user: c.demo, roles: c.demo === "alice" ? ["admin", "user"] : ["user"] } : null;
});
