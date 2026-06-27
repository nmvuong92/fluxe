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
   Sau mỗi thay đổi chạy `npm run test:all` (typecheck + 112 unit + 30 integration) **phải xanh**.
5. Tối ưu **lõi compiled** (Go/Rust) thuộc về đúng tầng (§6d); ở TS giữ đúng-đắn + cấu trúc đúng.

### Bảng tra DSA → ứng dụng backend (ứng viên khi gặp tín hiệu trên)

| Cần gì | Dùng | Đã áp trong fluxe |
|--------|------|--------------------|
| Lookup/cache/session/dedup O(1) | **Hash Table** (Map/Set) | wiring, broker, presence, resolver |
| Log/stream vòng, ghi O(1) | **Ring Buffer** | `observe.ts` (4.3× vs push/shift) |
| Cache/bucket bound bộ nhớ | **LRU Cache** | `ratelimit.ts` (chống rò RAM theo IP) |
| Route nhiều/động nhanh | **Trie / Radix tree** | *router.ts còn linear — nâng khi nhiều route* |
| Top-K / scheduler / priority | **Heap / Priority Queue** | — |
| Job nền, retry, fan-out | **Queue** | `jobs.ts` (SQLite, dead-letter) |
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
- Mọi feature/optimize ship kèm test (mock `Backend` rất dễ — `src/core/testing.ts`).

## Ranh giới (đừng phá)
- `app/` = dev sở hữu; `src/` = engine không đụng; `app/native/` = service polyglot (Go/Rust/Python/Hono/.NET/Java).
- **Cell tách 2 file** (giao-diện-vs-server, như SvelteKit/Astro): `view.tsx` = giao diện thuần (`export function <Comp>` + `export default <Comp>` + `export interface <Comp>Data`); `index.tsx` = `defineCell` route/loader/actions/head, `import { <Comp>, type <Comp>Data } from "./view"`. `fx new` sinh sẵn — đừng gộp lại 1 file, **đừng bỏ `export default` ở view** (client bundle import default).
- **`hydration` MẶC ĐỊNH "island"** (interactive) — cell/doc/tutorial **KHÔNG khai báo** `hydration`. Chỉ khai báo `hydration: "static"` khi opt-in tối ưu 0-JS (`fx new --static`). Static là **topic riêng** (`guides/static-cells.md`), không nhắc trong doc/tutorial chính.
- **View-only client bundle:** `client.tsx` chỉ import `app/views.ts` (registry view default, do `fx sync` sinh) → loader/actions/zod/backend **KHÔNG** ship xuống browser. Layout do server gửi kèm payload (`window.__FLUXE__.layout` + `fetchPageProps`). Đừng cho `client.tsx`/`nav-client.ts` import `app/app.ts` hay cell `index.tsx` (sẽ kéo server code vào client).
- "Backend nào chạy" do `app/profiles.ts` (config) hoặc live-swap devtools (DEV), **không** do vị trí folder.

## Tài liệu Starlight — LUÔN sync (BẮT BUỘC)

Docs site = **Starlight (Astro)** tại `docs-site/` (chạy: `cd docs-site && npm run dev`, port 4321).
Chọn Starlight vì khớp triết lý fluxe: static-first, 0 JS mặc định, island hydration.

**Khi đổi thứ có-mặt-trong-docs, cập nhật trang tương ứng NGAY trong cùng PR** (docs lệch code = lỗi):

| Đổi gì | Cập nhật trang |
|--------|----------------|
| RCA / resolution / manifest / 5 trục | `docs-site/.../guides/rca.md` |
| Thêm/sửa backend `app/native/*` hoặc `devBackend()`/`DEV_BACKENDS` | `guides/switch-backend.mdx` (bảng cổng + tab code-group + lệnh chạy) |
| Render cache / cell static / tối ưu perf (kèm số đo mới) | `guides/static-cache.md` |
| Endpoint runtime (`/_fluxe*`), ETag | `reference/observability.md` |
| DebugBar, header `x-fluxe-*`, chaos/live-swap | `reference/devtools.md` |
| Reference = **mỗi khái niệm 1 trang** (autogenerate theo `sidebar.order`); thêm tính năng core → tạo `reference/<khái-niệm>.md` mới + cập nhật `guides/features.md` | `reference/*.md` |
| Cách đăng ký cell (registry `app/app.ts` — DI tiêm vào `makeServer(manifest, cells)`), bootstrap, CLI/lệnh chạy | `guides/tutorial.mdx` + `reference/tooling.md` |
| Thêm/đổi thư mục, file infra app/, artifact sinh ra | `reference/project-structure.mdx` |
| Trang/khái niệm mới | thêm file + khai báo trong `sidebar` của `docs-site/astro.config.mjs` |

Quy ước: code snippet trong docs **copy nguyên văn từ source thật** (không bịa); polyglot dùng
`<Tabs syncKey="lang">`; số liệu perf phải là số ĐÃ ĐO (tenet §3), không ước lượng.

**Docs là TÀI LIỆU NGƯỜI DÙNG package, KHÔNG lộ engine `src/`:** mọi ví dụ import từ
`@nmvuong92/fluxe` / `/react` / `/client` / `/jobs` / `/sqlite` (KHÔNG `../../../src/...` hay
`@fluxe/`). KHÔNG dán comment `// src/core/X.ts` hay dump code nội bộ `server_factory` vào docs —
chỉ nói **cách dùng tính năng trong app của user** (định nghĩa + ví dụ + API package + lưu ý).
`src/` chỉ tồn tại để dev engine ở local; người dùng chỉ thấy `app/` + package.

## Bản quyền & giấy phép
- License **Apache-2.0** (permissive + patent grant; tác giả giữ TOÀN BỘ copyright → có thể relicense/bán sau). `LICENSE` + `NOTICE` ở root.
- **Mọi file source mới** phải mở đầu bằng header:
  `// Copyright (c) <year> nmvuong92` rồi `// SPDX-License-Identifier: Apache-2.0` (sau shebang nếu có).
- Contributor ký DCO + cấp quyền relicense (xem `CONTRIBUTING.md`) — giữ quyền bán/dual-license.

## Package & publish
- Engine publish dưới tên **`@nmvuong92/fluxe`** (subpath `/react`, `/client`, `/jobs`, `/sqlite`).
- **Local = src, published = lib:** `tsconfig` `paths` map `@nmvuong92/fluxe*` → `./src` (chạy thẳng, 0 build); `package.json` `exports` trỏ `./lib` (build qua `tsc -p tsconfig.build.json`, `prepublishOnly` tự build). Đừng để `client.tsx`/`nav-client.ts` import barrel server.
- Engine **KHÔNG import ngược `app/`** (cells + layouts tiêm qua DI `makeServer(manifest, cells, layouts)`) — điều kiện để publishable.
- Scaffold (`fx new`/`fx init`) sinh import `@nmvuong92/fluxe`; `import type` ở view để esbuild elide (không kéo server code vào client bundle).

## Release (TỰ ĐỘNG bump phiên bản — BẮT BUỘC nhớ)
- **Sau mỗi thay đổi đáng kể vào engine/package mà `test:all` xanh → CHỦ ĐỘNG release** (đừng chờ user nhắc):
  - `npm run release` (patch=fix) · `release:minor` (feature) · `release:major` (breaking) — chạy `test:all` + `npm version` + `git push --follow-tags`.
  - Push tag `v*` → `.github/workflows/release.yml` tự chạy test + `npm publish --provenance` (token `NPM_TOKEN` ở GitHub secrets, **bypass 2FA** nên CI publish không cần OTP).
- Chọn cấp bump theo **SemVer**: sửa lỗi/nội bộ = patch · thêm tính năng tương thích = minor · đổi API phá vỡ = major.
- CI: mọi push `main`/PR chạy `.github/workflows/ci.yml` (test:all + build) — phải xanh.

## Kết hợp Rust/native vào Node/TS (khi nào & cách) — BẮT BUỘC theo khi đụng perf core

**Nguyên tắc gốc: Rust KHÔNG thay Node — nó bù điểm yếu CPU-bound của V8** (GC + single-thread +
dynamic typing). Node giỏi I/O (event loop); dở ở hot loop tính toán: parse/transpile khối lớn,
nén/hash/crypto, xử lý ảnh, regex nặng, bundling nghìn module → native nhanh 5–50×.

**Chỉ đẩy xuống Rust khi ĐÃ ĐO bằng profiler** (tenet §3 "đo, đừng đoán"). Đừng thêm Rust vì
"nghe nhanh hơn" — I/O-bound (DB/API), CRUD, glue code thì Node đã đủ; thêm Rust = thêm FFI
boundary + build per-platform + người bảo trì hiếm.

### 3 con đường nối (khác hẳn use case)

| Cách | Công cụ | Cơ chế | Khi dùng | Đánh đổi |
|------|---------|--------|----------|----------|
| **N-API addon** (`.node`) | **napi-rs**, neon | gọi như hàm JS, **đồng bộ, share memory, KHÔNG serialize, 0 roundtrip** | server-side, cần tốc độ tối đa (SWC, Prisma làm vậy) | build per-platform (OS×arch) |
| **WASM** (`.wasm`) | wasm-bindgen, wasm-pack | sandbox, 1 artifact chạy Node + browser | code chạy **cả ở browser**, cần portable/an toàn | chậm hơn N-API ~10–30%, copy qua boundary |
| **Sidecar** | binary / microservice | HTTP/gRPC/stdio/**Unix socket** | tác vụ độc lập, tách deploy/scale | có **roundtrip** + serialize |

> Quy tắc chọn: chạy cả browser → **WASM**. Chỉ server + tốc độ tối đa → **N-API**. Tác vụ độc
> lập/ngôn ngữ khác → **sidecar**. Lý do mềm của native: memory-safe không GC, p99 ổn (không GC
> pause), single binary (gọn deploy, ít bề mặt supply-chain).

### Ánh xạ vào fluxe (RCA: transport là thứ được *resolve*)

- Backend hiện demo qua **HTTP sidecar** (`app/native/*`) — có roundtrip; **không phải** điểm
  mạnh tốc độ (xem docs switch-backend đã ghi honest). Mặc định `memory` in-process = 0 roundtrip.
- **Hướng tối ưu đúng chỗ (nếu sau này cần):** cell compute nặng đo được → adapter **napi-rs
  in-process** (transport `native`, 0 roundtrip — FFI ~0.03µs/call vs HTTP ~100–500µs).
- **ĐÃ ĐO bằng PoC napi-rs (máy 10 core) RỒI GỠ — vì kết quả cho thấy CHƯA đáng tích hợp.
  Đọc kỹ, đừng lặp sai lầm "Rust luôn nhanh hơn":**
  - Vòng lặp **scalar đơn luồng** (int hash & float mandelbrot): native **≈ 1.0×** — **V8 JIT ngang Rust -O3**. KHÔNG đáng thêm Rust.
  - **Đa luồng** (Rust `std::thread` 10 core vs JS 1 core): **8.0×** — đây là chỗ DUY NHẤT native thắng rõ.
  - → **Native chỉ thắng khi: đa luồng** (thoát main-thread Node), SIMD, GC/alloc-heavy, hoặc cần p99 ổn (không GC pause).
  - **Quyết định hiện tại: KHÔNG tích hợp Rust** — hot-path của fluxe là React SSR (V8) + I/O đơn luồng, không thuộc các loại trên. Chỉ dựng lại khi có cell compute **song-song-hoá-được**, ĐÃ ĐO bằng profiler. Đơn luồng số học thuần → để JS.
- **KHÔNG** rewrite core TS sang Rust: hot-path của fluxe là **React SSR render** (V8/React) +
  I/O — render-cache đã xử lý phần lặp; phần còn lại Rust không giúp. Crypto/scrypt/HMAC đã là
  native (node:crypto). Bundler đã native (esbuild/Go).
- Build tooling: nếu chậm đo được → cân nhắc **SWC/oxc/Biome** (Rust) thay Babel/ESLint.
