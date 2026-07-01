# CLAUDE.md — quy tắc làm việc trong repo fluxe

## Quy tắc DSA / tối ưu (BẮT BUỘC khi đụng code hot-path hoặc core)

Khi viết/sửa code — **nhất là `src/core/*`, runtime, hoặc đường nóng (per-request, vòng lặp,
realtime, parsing)** — phải:

1. **Nghiên cứu kỹ DSA/thuật toán TRƯỚC khi implement.** Hỏi: cấu trúc/thuật toán nào tối ưu
   cho thao tác chính ở đây? Độ phức tạp hiện tại là gì (O(n)? O(n²)? rò RAM?).
2. **Chỉ áp DS khi sửa một điểm dở ĐO ĐƯỢC** — không cargo-cult, không thêm cho đủ bộ.
   Tín hiệu đáng tối ưu: O(n)/O(n²) trên hot-path · `Array.shift/unshift` trong vòng lặp ·
   `Map`/cache không bound (rò RAM) · scan tuyến tính chỗ cần O(1)/O(log n) · re-parse/re-alloc mỗi request.
3. **ĐO, đừng đoán** (tenet idea.md §4f): chứng minh cải thiện bằng **micro-benchmark hoặc test
   số liệu** (vd "4.3× nhanh hơn", "size ≤ maxKeys"). Không có số → không nhận là tối ưu.
4. **KHÔNG break logic framework**: tối ưu phải **behavior-preserving** — output/test giữ nguyên.
   Sau mỗi thay đổi chạy `npm run test:all` (typecheck + ~115 unit + integration (selftest2)) **phải xanh**.
5. fluxe là **một runtime TS** — tối ưu ở đúng tầng TS (cấu trúc dữ liệu/thuật toán), KHÔNG đẩy sang native/polyglot (đã gỡ; xem §"Một runtime TS").

### Bảng tra DSA → ứng dụng backend (ứng viên khi gặp tín hiệu trên)

| Cần gì | Dùng | Đã áp trong fluxe |
|--------|------|--------------------|
| Lookup/cache/session/dedup O(1) | **Hash Table** (Map/Set) | wiring, broker, presence, resolver |
| Log/stream vòng, ghi O(1) | **Ring Buffer** | `observe.ts` (4.3× vs push/shift) |
| Cache/bucket bound bộ nhớ | **LRU Cache** | — (ratelimit ĐÃ GỠ — host lo) |
| Route nhiều/động nhanh | **Trie / Radix tree** | *router.ts còn linear — nâng khi nhiều route* |
| Top-K / scheduler / priority | **Heap / Priority Queue** | — |
| Job nền, retry, fan-out | **Queue** | — (jobs ĐÃ GỠ — host lo: bullmq…) |
| "Đã thấy chưa?" rẻ (dedup/rate) | **Bloom / Cuckoo filter** | — (idea.md 6b.G) |
| Đếm unique / tần suất xấp xỉ | **HyperLogLog / Count-Min** | — (idea.md 6b.G) |
| Shard distributed ổn định | **Consistent Hash** | — (khi scale 4d) |
| Tìm/sort/pagination | **Binary Search · Merge/Quick sort** | — |
| Dependency/workflow thứ tự | **Topological Sort** | — (jobs/pipeline tương lai) |
| Rate-limit / log cửa sổ | **Sliding Window** | (token-bucket hiện đủ) |
| Cây danh mục/menu/quyền | **Tree + BFS/DFS** | layoutChain (DFS chuỗi) |

> Ưu tiên thực dụng (idea.md): Hash Table · Queue · LRU · Ring Buffer · Heap · Trie ·
> Bloom/HLL · Binary Search · BFS/DFS · Topological Sort. Bỏ qua AVL/Fibonacci Heap/Segment Tree
> trừ khi có nhu cầu đo được.

## Kiểm thử (tenet T4)
- `npm run test:all` = typecheck + unit + integration — gate trước khi coi là "xong".
- Mọi feature/optimize ship kèm test (mock backend rất dễ — `app/testing.ts`).

## Ranh giới (đừng phá)
- `app/` = dev sở hữu; `src/` = engine không đụng. **Một runtime TS duy nhất** — KHÔNG polyglot/sidecar (đã gỡ).
- **UI viết bằng TSX** (`<Component/>`, JSX) — thân thiện, dễ đọc. **KHÔNG dùng `createElement`/`h(...)`** trừ khi bất khả (vd file `.ts` không JSX); khi buộc dùng, ghi lý do ngay tại chỗ. Áp cho cả template `fx` sinh ra (layout/cell/view đều TSX).
- **Monorepo npm workspaces:** repo root = engine `@nmvuong92/fluxe` (publish như cũ) + `"workspaces": ["app"]`. Mỗi project (app, app2…) là **workspace member tự chứa**: có `package.json` riêng (deps: `@nmvuong92/fluxe` link + react/fastify/zod), `tsconfig.json` riêng (paths `@backend/*`,`@frontend/*`,`@nmvuong92/fluxe`), scripts gọi `fx`. `fx init <name>` scaffold project đặt tên. **`app/` chỉ là output của `fx` — không implement tay ngoài generator; muốn đổi starter = sửa `scripts/init.ts`.**
- **fx scripts cwd-relative:** `sync/resolve/build/dev` thao tác `frontend/`, `backend/`, `.fluxe/`, `dist/` **theo cwd** (không hardcode `app/`) → chạy cho mọi project. Dogfood engine: `npm -w app run <script>`. Engine đọc file project qua **dynamic import từ cwd** (không static relative import vào project).
- **fluxe = CẦU NỐI RCA, KHÔNG tự làm thứ framework đã làm.** ĐÃ GỠ khỏi core: auth/session/scrypt/CSRF/RBAC, rate-limit, storage(upload), jobs(queue), DI container. Những thứ này là việc của **HOST framework** (Express/Fastify) + ecosystem (passport, express-rate-limit, multer, bullmq…) — mount middleware host TRƯỚC fluxe. `/__rpc`·`/__action` KHÔNG kiểm CSRF/rate-limit (host lo); `ctx.session` = host gắn `req.session` (fluxe không verify). **Đừng thêm lại** các thứ đã gỡ vào `src/` core. GIỮ trong core: cells/SSR, resolver, contract+/__rpc+validate, realtime (broker/SSE), observability (/_fluxe), seo, i18n, render-cache.
- **Batteries = plugin first-party `@fluxe/*`, KHÔNG phải core.** Ecosystem kiểu Laravel (storage/queue/notification…) quay lại dưới dạng **plugin package riêng** (`@fluxe/store · queue · signal`), opt-in — **KHÔNG nhét vào `src/` core** (dòng trên vẫn đúng). Đơn vị = `definePlugin()` (khớp từ vựng Fastify); app gom qua `createApp({ plugins })` = **thin composer trên `createHandler`** (merge cells/contract/config + capability DI + topo-sort `needs`). Mọi battery theo **một khuôn Driver**: interface + nhiều driver + **memory-default** (dev 0-config) = trục "State driver" của RCA. Plugin chỉ phụ thuộc `@fluxe/core` public, namespace theo `name`, `apiVersion` fail-fast. `boot()` có thể **trả `Dispose`** (đóng DB pool/worker) → `app.dispose()` chạy **ngược thứ tự topo**; `app[Symbol.asyncDispose]` cho `await using`. `broadcast` của `@fluxe/signal` **tái dùng broker/SSE core** (không reinvent realtime). Host mặc định dài hạn = **Fastify** (`@nmvuong92/fluxe/fastify`); Express giữ làm adapter thứ hai (Transport neutral). Chỉ hỗ trợ **Express + Fastify** (đã gỡ Hono/Nest). Spec: `docs/superpowers/specs/2026-07-01-fluxe-plugin-ecosystem-design.md`.
- **Cấu trúc app: `app/backend` + `app/frontend` (feature-module).** backend module = local plugin: `app/backend/modules/<x>/<x>.data|service|contract|resolvers|plugin.ts`, gom qua `createApp({ plugins })` trong `app/backend/app.ts`. frontend theo feature: `app/frontend/features/<feature>/<name>.cell.tsx + <name>.view.tsx`. Hạ tầng: `app/backend/{db,env,contract,server}.ts`, `app/frontend/{layouts,components,i18n,api,profiles}`, `app/backend/tests/` (unit/e2e/helpers/fixtures). Alias `@backend/*`, `@frontend/*`.
- **Cell tách 2 file** (giao-diện-vs-server, như SvelteKit/Astro): `<name>.view.tsx` = giao diện thuần (`export function <Comp>` + `export default <Comp>` + `export interface <Comp>Data`); `<name>.cell.tsx` = `defineCell` route/loader/actions/head, `import { <Comp> } from "./<name>.view"`. **cell.id === basename** của `<name>.cell.tsx`. `fx new <feature>/<name>` sinh sẵn — đừng gộp lại 1 file, **đừng bỏ `export default` ở view** (client bundle import default).
- **`hydration` MẶC ĐỊNH "island"** (interactive) — cell/doc/tutorial **KHÔNG khai báo** `hydration`. Chỉ khai báo `hydration: "static"` khi opt-in tối ưu 0-JS (`fx new --static`). Static là **topic riêng** (`guides/static-cells.md`), không nhắc trong doc/tutorial chính.
- **View-only client bundle:** `fx sync` sinh **2 file** trong `app/frontend/`: `registry.ts` (cells — server: route/loader) + `views.ts` (views — client). `client.tsx` chỉ import `app/frontend/views.ts` → loader/actions/zod/backend **KHÔNG** ship xuống browser. Đừng cho `client.tsx` import `registry.ts` hay `*.cell.tsx` (sẽ kéo server code vào client). Cả hai file sinh ra được gitignore (sync chạy trước trong `test:all`).
- **`app/backend/` = backend CỦA USER (thư mục)**: `app/backend/server.ts` (entry framework — Express/Fastify, mount fluxe) + `app/backend/db.ts` (driver data: interface domain + implement memory/node:sqlite/pg, export `makeDb`) + `app/backend/modules/<x>/` (nghiệp vụ theo feature) + `app/backend/app.ts` (`makeApp` = `createApp({ plugins })`). Inject qua `createApp/makeServer(…, { backend })`. Engine `Ctx<I,B>` generic, **KHÔNG ship driver/domain data nào** (đã gỡ `src/backends/*`). **Đừng** đóng-cứng domain backend vào engine lại.
- **Server entry = `app/backend/server.ts` (user-owned)**: user chọn framework + ghi logic backend của họ; fluxe mount **catch-all** lo concerns. Lõi request = `createHandler(manifest, cells, layouts, opts)` → handler Node `(req,res)`; `makeServer` = `http.createServer(createHandler(...))` (zero-config). 2 adapter subpath: `@nmvuong92/fluxe/express|fastify` (framework = **peerDependency optional**). `fx dev` chạy `app/backend/server.ts` (mặc định Express). **Đừng** bắt buộc framework — `makeServer` node:http vẫn là đường zero-dep.
- **Contract DSL (builder, 0 codegen — tRPC-style): `app/contract.ts` dùng `f` (lớp mỏng trên Zod): `f.object/query/mutation/subscription/contract`. 3 kind op: query (đọc) · mutation (ghi) · **subscription** (stream realtime = topic typed broker SSE, topic = op name; mutation publish qua `ctx.publish` arg 2 của resolver; client `api.<op>.useSubscription(cb)`). `Resolvers<C>` LOẠI subscription (nó là topic, không req/res). Types suy TỨC THÌ qua `Infer<>`/`Resolvers<typeof contract>`/`Client<C>` — KHÔNG `fx gen`, KHÔNG `.fluxe/gen`. Client = `createClient<typeof contract>()` (Proxy typed, `@nmvuong92/fluxe/client`, contract import type-only → 0 schema xuống browser). Runtime `/__rpc/<op>` đọc contract trực tiếp: validate qua **Standard Schema** (`validateStandard` — nhận Zod/Valibot/TypeBox…, `f` = sugar Zod mặc định; `op.input`); CSRF do HOST lo. Resolvers tiêm `{ contract, resolvers }` (fallback `{ backend }`); DB ẩn sau resolver — `actions/rpc` cũ giữ nguyên (lớp THÊM). Resolver query/mutation nhận `ctx` (arg 2) = `{ publish, span }`: `publish`→topic subscription, `span(name,fn)`→span con cho waterfall. ĐỪNG quay lại string DSL / codegen.**
- **Auth = INTEGRATION (`@nmvuong92/fluxe/auth`), KHÔNG reinvent engine auth.** Provider (better-auth/lucia/passport) lo OAuth/password/2FA/issue+verify session. fluxe chỉ cho **lớp tích hợp RCA-native**: `bridgeSession(getSession)` (node middleware → gắn `req.session`, mount TRƯỚC fluxe), `protect(role?)` (guard route host), endpoint `/__session` (trả `req.session` JSON), `useSession()` (react `@nmvuong92/fluxe/react`, đọc /__session typed), guard **khai báo**: cell `requireRole`/`requireAuth` + contract op `{ auth: true|role }` (kiểm trong `handleRpc` → 401/403). Session **typed** xuyên cell qua contract op `{ auth }`. **Đừng** build OAuth/password/cookie engine vào core.
- **Typed routes:** `route` literal → `ctx.input` suy qua `RouteParams<R>` (template-literal type). `defineCell` từ package = B/S mặc định. Cell registry `app/frontend/registry.ts` (sinh bởi `fx sync`) type `CellDef<any,any,any,any>`.

## Tài liệu Starlight — LUÔN sync (BẮT BUỘC)

Docs site = **Starlight (Astro)** tại `docs-site/` (chạy: `cd docs-site && npm run dev`, port 4321).
Chọn Starlight vì khớp triết lý fluxe: static-first, 0 JS mặc định, island hydration.

**Khi đổi thứ có-mặt-trong-docs, cập nhật trang tương ứng NGAY trong cùng PR** (docs lệch code = lỗi):

| Đổi gì | Cập nhật trang |
|--------|----------------|
| Thêm/sửa contract DSL/codegen/__rpc | `reference/contract.md` |
| RCA / resolution / manifest / 5 trục | `docs-site/.../guides/rca.md` |
| Thêm/sửa backend driver TS (memory/sqlite/postgres) | `reference/data.md` |
| Thêm/sửa adapter server (`src/adapters/*`), `createHandler`, `app/backend/server.ts` | `guides/server-framework.mdx` |
| Auth integration (`src/auth/*` bridgeSession/protect, `/__session`, `useSession`, op `auth`, cell `requireRole`) | `reference/auth.md` |
| Client hook (`src/react/*` createHooks/useQuery/useMutation/useForm/invalidateQueries) | `reference/data-fetching.md` |
| Span tracing/waterfall (`src/core/trace.ts`, `ctx.span`, header `x-fluxe-trace`, DebugBar waterfall) | `reference/devtools.md` + `reference/configuration.md` |
| Render cache / cell static / tối ưu perf (kèm số đo mới) | `guides/static-cache.md` |
| Endpoint runtime (`/_fluxe*`), ETag | `reference/observability.md` |
| DebugBar, header `x-fluxe-*`, chaos | `reference/devtools.md` |
| Reference = **mỗi khái niệm 1 trang** (autogenerate theo `sidebar.order`); thêm tính năng core → tạo `reference/<khái-niệm>.md` mới + cập nhật `guides/features.md` | `reference/*.md` |
| Cách đăng ký cell (registry `app/frontend/registry.ts` — sinh bởi `fx sync`), bootstrap, CLI/lệnh chạy | `guides/tutorial.mdx` + `reference/tooling.md` |
| Thêm/đổi thư mục, file infra app/, artifact sinh ra | `reference/project-structure.mdx` |
| Trang/khái niệm mới | thêm file + khai báo trong `sidebar` của `docs-site/astro.config.mjs` |

Quy ước: code snippet trong docs **copy nguyên văn từ source thật** (không bịa); số liệu perf
phải là số ĐÃ ĐO (tenet §3), không ước lượng.

**Docs là TÀI LIỆU NGƯỜI DÙNG package, KHÔNG lộ engine `src/`:** mọi ví dụ import từ
`@nmvuong92/fluxe` / `/react` / `/client` / `/express` / `/fastify` / `/auth` (KHÔNG `../../../src/...` hay
`@fluxe/`). KHÔNG dán comment `// src/core/X.ts` hay dump code nội bộ `server_factory` vào docs —
chỉ nói **cách dùng tính năng trong app của user** (định nghĩa + ví dụ + API package + lưu ý).
`src/` chỉ tồn tại để dev engine ở local; người dùng chỉ thấy `app/` + package.

## Config / ENV (BẮT BUỘC mỗi tính năng)
- Mọi tham số tinh chỉnh quan trọng phải **expose ra ENV** theo quy ước **`FLUXE_<FEATURE>_<PARAM>`**, có default hợp lý, đưa vào `src/core/config.ts` (`FluxeConfig` + `loadConfig`) + `ENV_KEYS`.
- Engine đọc từ `config` (DI `makeServer(…, { config })`), **KHÔNG hardcode** số trong code. Thứ tự: default ← ENV ← override. Validate Zod (fail-fast).
- **Tài liệu** biến đó vào bảng `reference/configuration.md` + trang reference của tính năng (mục `## ENV`). `fx config` in config đã giải.

## Bản quyền & giấy phép
- License **Apache-2.0** (permissive + patent grant; tác giả giữ TOÀN BỘ copyright → có thể relicense/bán sau). `LICENSE` + `NOTICE` ở root.
- **Mọi file source mới** phải mở đầu bằng header:
  `// Copyright (c) <year> nmvuong92` rồi `// SPDX-License-Identifier: Apache-2.0` (sau shebang nếu có).
- Contributor ký DCO + cấp quyền relicense (xem `CONTRIBUTING.md`) — giữ quyền bán/dual-license.

## Package & publish
- Engine publish dưới tên **`@nmvuong92/fluxe`** (subpath `/react`, `/client`, `/express`, `/fastify`, `/auth`).
- **Local = src, published = lib:** `tsconfig` `paths` map `@nmvuong92/fluxe*` → `./src` (chạy thẳng, 0 build); `package.json` `exports` trỏ `./lib` (build qua `tsc -p tsconfig.build.json`, `prepublishOnly` tự build). Đừng để `client.tsx`/`nav-client.ts` import barrel server.
- Engine **KHÔNG import ngược `app/`** (cells + layouts tiêm qua DI `makeServer(manifest, cells, layouts)`) — điều kiện để publishable.
- Scaffold (`fx new`/`fx init`) sinh import `@nmvuong92/fluxe`; `import type` ở view để esbuild elide (không kéo server code vào client bundle).

## Release (TỰ ĐỘNG bump phiên bản — BẮT BUỘC nhớ)
- **Sau mỗi thay đổi đáng kể vào engine/package mà `test:all` xanh → CHỦ ĐỘNG release** (đừng chờ user nhắc):
  - `npm run release` (patch=fix) · `release:minor` (feature) · `release:major` (breaking) — chạy `test:all` + `npm version` + `git push --follow-tags`.
  - Push tag `v*` → `.github/workflows/release.yml` tự chạy test + `npm publish --provenance` (token `NPM_TOKEN` ở GitHub secrets, **bypass 2FA** nên CI publish không cần OTP).
- Chọn cấp bump theo **SemVer**: sửa lỗi/nội bộ = patch · thêm tính năng tương thích = minor · đổi API phá vỡ = major.
- CI: mọi push `main`/PR chạy `.github/workflows/ci.yml` (test:all + build) — phải xanh.

## Một runtime TS — KHÔNG polyglot (quyết định kiến trúc, ĐÃ ĐO)

fluxe là **một runtime TypeScript duy nhất** trên `node:http` zero-dep. **Đã gỡ hoàn toàn**
polyglot (Go/Rust/Java/.NET/Python sidecar, transport http, codegen Go/Rust, live backend swap) —
xem spec `docs/superpowers/specs/2026-06-27-remove-polyglot-single-ts-backend-design.md`. Backend =
driver data TS in-process: `memory | sqlite | postgres`. **Đừng thêm lại** polyglot/sidecar.

**Vì sao (đã đo bằng PoC napi-rs, máy 10 core, RỒI GỠ — đừng lặp sai lầm "Rust luôn nhanh hơn"):**
- Vòng lặp **scalar đơn luồng** (int hash & float mandelbrot): native **≈ 1.0×** — **V8 JIT ngang
  Rust -O3**. KHÔNG đáng thêm Rust.
- **Đa luồng** (Rust `std::thread` 10 core vs JS 1 core): **8.0×** — chỗ DUY NHẤT native thắng rõ.
- → Native chỉ thắng khi **đa luồng** (thoát main-thread), SIMD, GC/alloc-heavy, hoặc cần p99 ổn.
  Hot-path của fluxe là **React SSR (V8) + I/O đơn luồng** — không thuộc các loại trên. Crypto đã là
  native (node:crypto), bundler đã native (esbuild).
- **KHÔNG** rewrite core TS sang Rust. Build tooling: nếu chậm đo được → cân nhắc SWC/oxc/Biome.
- Nếu **tương lai** có cell compute song-song-hoá-được ĐÃ ĐO bằng profiler → cân nhắc adapter
  **napi-rs in-process** (0 roundtrip, FFI ~0.03µs/call) — KHÔNG quay lại HTTP sidecar.
