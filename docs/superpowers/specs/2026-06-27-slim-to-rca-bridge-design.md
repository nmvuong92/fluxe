# Slim fluxe → cầu nối RCA (bỏ thứ framework đã làm)

**Ngày:** 2026-06-27
**Trạng thái:** chốt qua brainstorm, breaking lớn (0.x → minor). Net BỚT code.

## Mục tiêu

fluxe = **cầu nối FE ↔ backend framework** (cells/SSR + contract/rpc). Bỏ mọi thứ Express/Hono/Nest +
ecosystem đã làm (auth, csrf, ratelimit, storage, jobs, DI). Vì fluxe mount NHƯ middleware → csrf/auth/
ratelimit của host (mount trước) đã bảo vệ `/__rpc`,`/__action` → bản sao trong fluxe thừa.

## KEEP (RCA bridge — framework không làm được)

engine/`defineCell` · resolver/manifest · `createHandler`/`makeServer` · adapters (express/hono/nest) ·
**contract + `/__rpc` + validate (Zod)** · client (rpc/createClient) · React kit · SEO · i18n/Resolved
Shell · render cache · layouts · `FluxeError` · **realtime** (broker/presence + `/__sse`) ·
**observability** (`observe.ts`+`panel.ts`+`/_fluxe/*`).

## REMOVE (framework/ecosystem làm)

- `src/core/auth.ts` (session HMAC, scrypt, CSRF, RBAC) — **trừ `parseCookie`** → chuyển `src/core/cookie.ts`.
- `src/core/ratelimit.ts`, `src/core/container.ts`, `src/core/multipart.ts`, `src/core/jobs.ts`, `src/storage/*`.
- Endpoints `createHandler`: `/__upload`, `/__file`, `/login`, `/logout`; bỏ CSRF + rate-limit ở `/__action` & `/__rpc`.
- Subpath `/jobs`, `/sqlite`(đã gỡ); barrel bỏ auth/ratelimit/storage/jobs/container/multipart.
- `config.ts`: bỏ `rateLimit`/`upload`. `secret` chỉ session dùng → bỏ (giữ `port`/`renderCache`/`i18n`/`observe`).

## Hệ quả wiring

- `ctx.session` = **host gắn** `(req as any).session` (fluxe không verify). Cell cần auth → host lo.
- `/__rpc` (rpc.ts): bỏ check CSRF mutation. `/__action`: bỏ csrf + ratelimit. Giữ validate + broker.publish.
- broker/presence: **eager** (bỏ container lazy). `/_fluxe/stats.bootstrapped` bỏ (không còn container).
- `makeServer` zero-config: MẤT bảo vệ built-in → production luôn chạy trên 1 framework (doc rõ).

## Components đụng

- `src/server_factory.ts` — gỡ: import auth(verifySession/newCsrfToken)/ratelimit/storage/container/handleUpload;
  gỡ block `/__upload`,`/__file`,`/login`,`/logout`, csrf-cookie, action csrf+ratelimit; broker/presence eager;
  session = `(req as any).session`. Giữ /__rpc,/__action(no-csrf),/__sse,/_fluxe,locale,render,SSR.
- `src/core/cookie.ts` (mới) — `parseCookie` (move từ auth).
- `src/core/rpc.ts` — bỏ CSRF mutation check (host lo); giữ validate + dispatch.
- `src/index.ts` — bỏ export auth/ratelimit/storage/jobs/container/multipart; thêm cookie nếu cần.
- `src/core/config.ts` + `config.test.ts` — shrink.
- Xoá file: auth.ts, ratelimit.ts, container.ts, container.test.ts, multipart.ts, multipart.test.ts, jobs.ts,
  storage/*, + test tương ứng (auth.test, ratelimit.test...).
- `package.json` exports — bỏ `./jobs` (+ `./sqlite` nếu còn).
- Demo: cell `admin`/`secret` (requireRole/session) → đơn giản hoá hoặc xoá; `app/app.ts` regen; selftest2 bỏ
  check `[auth]/[rbac]/[csrf]/[ratelimit]/[upload]`; app/cells/* dùng storage/auth → gỡ.

## Testing (gate test:all xanh)

- Sau gỡ: `test:all` xanh (xoá test của module đã bỏ; selftest2 còn check static/island/render/sse/observe/
  contract /__rpc/validate). Smoke: Express demo `/`, `/todos`, `/__rpc/todos`, `/__sse`, `/_fluxe`.
- Quét grep: 0 ref `auth`/`ratelimit`/`storage`/`jobs`/`container`/`multipart`/`/__upload`/`/login` trong src/app
  (trừ comment lịch sử).

## Phi mục tiêu
- Không tự làm auth/csrf/ratelimit (host + ecosystem).
- Không giữ zero-config-secure (production = framework).
- Không đụng RCA core (cells/SSR/contract/rpc/react).

## Thứ tự (phase, gate test:all)
1. `cookie.ts` (move parseCookie) + broker/presence eager (bỏ container) trong server_factory.
2. server_factory gỡ auth/csrf/ratelimit/upload/login/logout/file; rpc.ts bỏ csrf.
3. Xoá file module + barrel + config shrink + package exports.
4. Demo cells (admin/secret) + selftest2 + app cells dùng storage/auth.
5. Docs (gỡ trang auth/csrf/rbac/password/session/rate-limit/storage/jobs/env-config thừa; nói host lo) + CLAUDE + release.
