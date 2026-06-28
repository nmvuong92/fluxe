// AUTH của bạn — bridge provider (better-auth) vào fluxe. fluxe KHÔNG verify, chỉ đọc req.session.
// better-auth lo password/session/cookie (app/backend/auth-server.ts); ở đây map sang AppSession.
import { bridgeSession } from "../src/auth";   // published: @nmvuong92/fluxe/auth
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./backend/auth-server";

// Session typed xuyên cell qua createCells<Backend, AppSession>() (app/cell.ts).
export interface AppSession { id: string; user: string; roles: string[] }

export const sessionMw = bridgeSession(async (req): Promise<AppSession | null> => {
  const s = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!s?.user) return null;
  return { id: s.user.id, user: s.user.email, roles: [(s.user as any).role || "bidder"] };
});
