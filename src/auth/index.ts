// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Auth INTEGRATION (RCA-native) — fluxe KHÔNG tự làm auth. Bạn dùng provider (better-auth/lucia/
 * passport); fluxe bridge session của họ vào ctx.session + guard route. node middleware (req,res,next):
 * Express/Nest dùng thẳng; Hono qua adapter. Mount TRƯỚC fluxe. */
import type http from "node:http";
import { FluxeError } from "../core/errors.ts";

type Req = http.IncomingMessage & { session?: any };
type Res = http.ServerResponse;
type Next = (err?: unknown) => void;
type Middleware = (req: Req, res: Res, next: Next) => void;

/* bridgeSession(getSession) — chạy getSession của provider mỗi request → gắn req.session.
 *   app.use(bridgeSession((req) => betterAuth.api.getSession({ headers: req.headers })));
 * getSession trả session (shape tuỳ provider) | null. Lỗi → null (không chặn request). */
export function bridgeSession(getSession: (req: Req) => unknown | Promise<unknown>): Middleware {
  return (req, _res, next) => {
    Promise.resolve()
      .then(() => getSession(req))
      .then((s) => { req.session = s ?? null; next(); })
      .catch(() => { req.session = null; next(); });
  };
}

/* protect(role?) — guard route HOST (không phải cell): chưa đăng nhập → 401; thiếu role → 403.
 *   app.get("/admin", protect("admin"), handler);  (đặt SAU bridgeSession) */
export function protect(role?: string): Middleware {
  return (req, _res, next) => {
    const s: any = req.session;
    if (!s) return next(new FluxeError("unauthorized", "Cần đăng nhập", 401));
    if (role && !(Array.isArray(s.roles) && s.roles.includes(role))) {
      return next(new FluxeError("forbidden", `Cần quyền '${role}'`, 403));
    }
    next();
  };
}
