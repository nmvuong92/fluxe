---
title: Auth (integration)
description: fluxe KHÔNG tự làm auth — bạn dùng provider (better-auth/lucia/passport), fluxe bridge session vào ctx.session typed + guard cell/contract + useSession. RCA-native, không reinvent.
sidebar:
  order: 12
---

fluxe **không build engine auth** (OAuth/password/2FA/session/DB = việc của **provider**:
better-auth, lucia, passport…). fluxe cho **DX RCA-native**: bridge session host → `ctx.session`
**có kiểu**, guard **khai báo** trên cell + contract op, hook `useSession()`. Hợp triết lý
"fluxe = cầu nối, host lo cross-cutting".

## 1. Bridge session (wire provider 1 lần)

`bridgeSession(getSession)` = node middleware chạy `getSession` của provider mỗi request → gắn
`req.session`. Mount **TRƯỚC** fluxe.

```ts
// app/auth.ts
import { bridgeSession } from "@nmvuong92/fluxe/auth";
import { auth } from "./better-auth";   // instance better-auth của bạn

export interface AppSession { user: string; roles: string[] }

export const sessionMw = bridgeSession((req) =>
  auth.api.getSession({ headers: req.headers })   // provider lo verify/issue
);
```

```ts
// app/backend/server.ts — mount TRƯỚC fluxe
app.use(sessionMw);
app.use(fluxe(manifest, cells, layouts, { backend, contract, resolvers }));
```

> Lucia / passport / next-auth: cùng pattern — `bridgeSession((req) => yourProvider.getSession(req))`.

## 2. `ctx.session` có kiểu (xuyên cell)

Bind session type một lần qua `createCells<Backend, Session>()`:

```ts
// app/cell.ts
import { createCells } from "@nmvuong92/fluxe";
import type { Backend } from "./backend/data";
import type { AppSession } from "./auth";
export const defineCell = createCells<Backend, AppSession>();
// cell: loader({ session }) → session: AppSession | null (typed)
```

## 3. Guard khai báo

**Cell** (page-level): `requireAuth` / `requireRole`:
```ts
defineCell({ id: "admin", route: "/admin", requireRole: "admin", loader: ... });
// chưa có session → 401; thiếu role → 403 (đọc session host gắn)
```

**Contract op** (RPC-level): tham số `{ auth }`:
```ts
export const contract = f.contract({
  todos:   f.query(Todo.array()),
  delete:  f.mutation({ id: f.string }, f.bool, { auth: "admin" }),  // /__rpc/delete cần role admin
  profile: f.query(User, { auth: true }),                            // chỉ cần đăng nhập
});
// /__rpc: !session → 401; thiếu role → 403
```

## 4. `useSession()` (React client)

```tsx
import { useSession } from "@nmvuong92/fluxe/react";
import type { AppSession } from "../auth";

function Header() {
  const { data, status, signOut } = useSession<AppSession>();
  if (status === "loading") return null;
  return data
    ? <button onClick={() => signOut("/api/auth/sign-out")}>Chào {data.user}</button>
    : <a href="/api/auth/sign-in">Đăng nhập</a>;   // provider lo UI login/OAuth
}
```

Đọc qua endpoint `/__session` (fluxe trả `req.session` JSON). `signIn` = redirect tới provider.

## 5. Guard route HOST (ngoài fluxe)

`protect(role?)` cho route Express/Fastify riêng của bạn:
```ts
import { protect } from "@nmvuong92/fluxe/auth";
app.get("/api/admin", protect("admin"), handler);   // 401/403 trước khi vào handler
```

## Ranh giới

| fluxe (integration) | provider (better-auth/lucia…) |
|---------------------|-------------------------------|
| bridge session → `ctx.session` typed | issue/verify session, cookie |
| guard cell `requireRole` + contract `auth` | OAuth, password, magic-link, 2FA |
| `/__session` + `useSession()` | DB adapter, account/org |
| `protect()` host route | login/signup UI + endpoints |

→ "đầy đủ như better-auth" (qua provider) + "tốt nhất cho fluxe" (typed, khai báo, RCA-native).
