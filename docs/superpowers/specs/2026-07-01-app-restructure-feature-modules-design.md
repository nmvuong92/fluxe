# Tái cấu trúc app/ — backend + frontend theo feature-module (fx init mới)

**Ngày:** 2026-07-01
**Trạng thái:** spec đã chốt qua brainstorm (6 quyết định), chờ user review trước khi plan.

## Mục tiêu

`fx init` sinh cấu trúc `app/backend` + `app/frontend` **feature-module**, DX tốt: gọn, tên gợi
nhớ, dễ tìm, scale theo module, **ít magic/overhead như Nest**, có **vùng test riêng**. Áp luôn
cho repo (wipe `app/` → starter tối thiểu). Không dùng monorepo tool (folder + path alias).

## Quyết định (chốt qua brainstorm)

1. **Không monorepo tool** — folder + path alias (`@backend/*`, `@frontend/*`). fluxe là MỘT app;
   Nx/Turborepo là overhead/magic đi ngược triết lý. Nâng workspaces sau nếu thật sự cần.
2. **Backend = feature-module = local plugin** — mỗi module gói `{data, service, contract,
   resolvers, plugin}`; `createApp({ plugins })` ghép (tái dùng hệ plugin đã xây). Scale = thêm folder.
3. **Vùng test riêng (mirror)** — mọi test trong `tests/` soi gương module (không co-located).
4. **Frontend theo feature, mirror backend** — `app/frontend/features/<x>/<name>.cell.tsx +
   <name>.view.tsx`; cộng `layouts/`, `components/`, `i18n.ts`, `registry.ts` (sinh), `profiles.ts`.
5. **fx init prompt 3 trục** — data driver (memory|sqlite|postgres) · framework (express|fastify,
   default fastify) · auth (có/không). Luôn sinh starter tối thiểu.
6. **Bỏ bidly** — `app/` = starter tối thiểu (home + greet + todos [+ auth]); `selftest2` viết lại
   trỏ starter mới, vẫn phủ engine surface (SSR static/island, /__rpc, SSE, i18n, guard).

## Cây thư mục

```
app/
  backend/
    modules/
      todos/
        todos.data.ts        # interface TodoStore + memory driver
        todos.service.ts     # nghiệp vụ (dùng data)
        todos.contract.ts    # f.query/mutation
        todos.resolvers.ts   # handler
        todos.plugin.ts      # definePlugin({ name, contract, resolvers, needs:["db"] })
      auth/                  # (nếu chọn auth) — bridgeSession + guard
    db.ts                    # driver đã chọn (memory|sqlite|postgres) → provide "db"
    contract.ts              # STATIC spread contract các module (giữ type cho client)
    app.ts                   # createApp({ plugins:[todos, auth?], backend })
    server.ts                # Fastify|Express mount app.handler
    env.ts
    tests/
      unit/    todos.service.test.ts
      e2e/     todos.e2e.test.ts        # boot createApp+Fastify, HTTP thật
      fixtures/  helpers/  (makeTestApp, mock-backend, factories)
  frontend/
    features/
      home/   home.cell.tsx   home.view.tsx
      greet/  greet.cell.tsx  greet.view.tsx
      todos/  todos.cell.tsx  todos.view.tsx
    layouts/    site.tsx
    components/  (UI dùng chung)
    i18n.ts
    registry.ts   # SINH bởi fx sync (cells[] + views[]) — thay app/app.ts + app/views.ts
    profiles.ts
    tests/  unit/
```

Alias: `@backend/*` → `app/backend/*`, `@frontend/*` → `app/frontend/*`.

## Quy ước tên

- **Cell 2 file đổi tên:** `<name>.cell.tsx` (route+loader/actions/head) + `<name>.view.tsx`
  (UI thuần, `export function <Comp>` + `export default` + `export interface <Comp>Data`).
  Thay `index.tsx`/`view.tsx` lồng. Phẳng, dễ grep, gợi nhớ. **BREAKING** với quy ước cũ.
- Backend: `<x>.data|service|contract|resolvers|plugin.ts`.
- Test: mọi test trong `tests/`, file `*.test.ts` (e2e = `*.e2e.test.ts` để 1 runner bắt).

## Ghép nối (0 magic)

- Mỗi module export `definePlugin`. `app/backend/app.ts` = `createApp({ plugins })`. Scale = thêm
  folder module + thêm vào mảng plugins (tường minh, không auto-scan magic ở backend).
- `app/backend/contract.ts` = static spread contract module → `createClient<typeof contract>()`
  suy type (import type-only, 0 runtime schema xuống browser).
- `db.ts` provide capability `"db"`; module `needs:["db"]` → topo-sort lo thứ tự boot.

## Engine phải sửa (xuyên suốt)

- `scripts/sync.ts`: quét `app/frontend/features/**/*.cell.tsx` (+ `.view.tsx`) → sinh
  `app/frontend/registry.ts` (cells[] + views[]). Thay `CELLS_DIR="app/cells"` + index/view.
- `scripts/resolve.ts`: import `@frontend/registry` + `@frontend/profiles` (thay `../app/app`,
  `../app/profiles`).
- `src/client.tsx`: import `@frontend/registry` (views) + `@frontend/layouts`.
- `tsconfig.json`: thêm alias `@backend/*`, `@frontend/*`.
- `scripts/init.ts` (fx init) + `fx new`: sinh layout mới; prompt 3 trục.
- `CLAUDE.md`: cập nhật quy ước cell 2-file + ranh giới app/.

## Test & selftest2

- `selftest2.ts` viết lại trỏ starter mới: SSR static (greet/home) · island + `/__rpc` (todos) ·
  SSE subscription (todos realtime) · i18n · guard (nếu auth). Bỏ mọi ref bidly/lots.
- Unit mẫu: `app/backend/tests/unit/todos.service.test.ts` (mock data qua helper).
- E2E mẫu: `app/backend/tests/e2e/todos.e2e.test.ts` (createApp + Fastify, HTTP thật).
- `test:unit` glob `{src,app}/**/*.test.ts` vẫn bắt (e2e đặt `.e2e.test.ts`).

## Thực thi (phased — mỗi phase `test:all` xanh)

1. **Engine enablement**: sửa sync/resolve/client/tsconfig + `fx new` cho layout mới.
2. **Wipe + regen app/**: xoá app/ cũ, sinh starter (modules todos[/auth] + frontend features + tests).
3. **Rewrite selftest2** + unit/e2e mẫu → `test:all` xanh.
4. **Docs**: server-framework, project-structure, tutorial, CLAUDE.md.

## Rủi ro / phạm vi

- **BREAKING** quy ước cell (index→*.cell) → release `major`.
- Blast radius lớn (engine scan + toàn app + tests). Làm theo phase, không gộp một cú.
- `client.tsx` build (`build:client`) phải trỏ registry mới — kiểm bundle không kéo server code.

## Không làm (YAGNI)

- Không monorepo tool, không workspaces, không `core/` layer (tránh khái niệm 'core vs module').
- Không giữ bidly / không examples/ (user chọn bỏ hẳn).
