# Auth integration RCA-native (không reinvent — dùng better-auth/lucia)

**Ngày:** 2026-06-27
**Trạng thái:** chốt qua brainstorm. Hợp slim 0.12.0 (fluxe KHÔNG tự làm engine auth — provider lo).

## Mục tiêu

Auth "đầy đủ như better-auth" (qua provider) + "tốt nhất cho fluxe" (RCA-native DX). fluxe chỉ là
**lớp tích hợp**: bridge session host→fluxe, session TYPED xuyên cell+contract+React, guard khai báo,
`useSession()` hook, `/__session` endpoint. Provider (better-auth/lucia) lo OAuth/password/2FA/session/DB.

## Components

1. **`/__session` endpoint (core, src/server_factory.ts)** — `GET /__session` → JSON `req.session ?? null`.
   Cho client hook đọc session host gắn. Tiny.
2. **`@nmvuong92/fluxe/auth` (src/auth/index.ts)**:
   - `bridgeSession(getSession): NodeHandler-middleware` — `async (req,res,next) => { req.session = await getSession(req) ?? null; next() }` (catch → null). Host mount TRƯỚC fluxe.
   - `protect(role?): middleware` — guard route HOST: `!session` → 401; `role` && !hasRole → 403. (tuỳ dùng)
3. **Contract op auth (src/core/contract.ts + rpc.ts)** — `f.query/mutation(..., { auth })` (`auth?: true | string`).
   `OpDef` thêm `auth?`. `/__rpc` (handleRpc) nhận `session`, kiểm: `auth===true` && !session → 401; `auth:string`
   && !role → 403.
4. **`useSession()` (src/react/session.ts)** — `{ data, status, signOut, refetch }`. status =
   "loading"|"authenticated"|"unauthenticated". Fetch `/__session`. `signOut(url?)` POST url (config). Typed.
5. **Typed session xuyên cell** — `Ctx<I,B,S=Session>`, `createCells<B, S=Session>()` → `ctx.session: S`.
   (default S=Session → backward compat.)
6. **Docs** — `reference/auth.md`: wire better-auth + lucia (bridgeSession), guard cell+contract, useSession.

## Quyết định

- fluxe KHÔNG: OAuth, password hashing, session issuing, DB adapter, 2FA → **provider**.
- fluxe CÓ: bridge (host session → ctx.session typed), declare (cell.requireRole + contract op.auth),
  expose (`/__session` + `useSession`), guard host route (`protect`). = integration, không reimplement.
- `bridgeSession`/`protect` = node middleware (Express/Nest dùng thẳng; Hono qua adapter sẵn nếu cần).
- `req.session` shape do provider quyết; fluxe type qua generic S (user khai 1 lần ở `createCells<B,S>`).

## Data flow

1. Host: `app.use(bridgeSession((req)=>betterAuth.getSession(req)))` TRƯỚC `app.use(fluxe(...))`.
2. Request → bridge gắn `req.session` → fluxe đọc → `ctx.session` (cell loader), kiểm guard cell/contract.
3. Client: `useSession()` → GET `/__session` → `{data,status}`; `signOut()` → POST provider url.

## Testing (gate test:all xanh)

- `bridgeSession`: getSession trả session → req.session set; throw → null. (unit, mock req)
- `protect`: !session → 401; thiếu role → 403; đủ → next. (unit)
- `/__session`: trả req.session JSON (integration qua makeServer).
- contract op auth: `/__rpc/x` op.auth="admin", session thiếu role → 403; đủ → 200. (rpc.test)
- `useSession`: (DOM-less) — test logic parse status từ /__session (nếu tách pure); hoặc smoke.
- Type: `createCells<B,S>()` → ctx.session: S (engine.test type-level).
- behavior-preserving: cell requireRole cũ vẫn chạy; test:all xanh.

## Phi mục tiêu
- Không OAuth/password/2FA/DB trong fluxe (provider).
- Không session store riêng (provider).
- Không `<SignedIn>` component v1 (có thể thêm sau, nhỏ).

## Thứ tự (phase, gate test:all)
1. `/__session` endpoint + `src/auth/index.ts` (bridgeSession, protect) + barrel/subpath/peerDeps. Unit.
2. Contract op `auth` (contract.ts opts + OpDef) + rpc.ts kiểm session + rpc.test.
3. Typed session: `Ctx<I,B,S>` + `createCells<B,S>` + engine.test.
4. `useSession()` (react) + export /react.
5. Demo: app/auth.ts (bridge stub) + 1 cell/op dùng guard; docs reference/auth.md + features + CLAUDE.
6. Release minor.
