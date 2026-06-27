# Bỏ polyglot — fluxe về một runtime TS duy nhất

**Ngày:** 2026-06-27
**Trạng thái:** spec đã chốt qua hỏi-đáp, chờ user review trước khi plan.

## Mục tiêu

Bỏ hoàn toàn khái niệm **đa-backend polyglot** (Go/Rust/Java/Python/.NET/Hono sidecar) khỏi fluxe.
Engine chỉ còn **một runtime TS duy nhất** chạy trên `node:http` **zero-dep** (giữ core tự thân,
KHÔNG bệ Express/Fastify/Hono). RCA thu lại còn hai trục: **render** (static/island) + **data** (TS).

## Quyết định (chốt qua brainstorm)

1. **Nền HTTP:** giữ core `node:http` tự thân của fluxe (zero-dep). Không thêm framework ngoài —
   giữ tiêu chí "engine publishable zero-dep + tối giản".
2. **Độ sâu:** bỏ sạch. `BackendKind` chỉ còn các driver **TS thuần**. Bỏ `transport: "http"`,
   `endpoints`, codegen Go/Rust, live backend swap sang go/rust.
3. **Backend giữ lại (đều TS thuần):** `memory`, `sqlite`, `postgres`.
   `BackendKind = "memory" | "sqlite" | "postgres"`. (Nếu user muốn đúng memory+sqlite → bỏ postgres.)
4. Transport collapse: mọi backend đều **in-process** → bỏ field `transport`/`endpoint` khỏi
   `BackendResolution`.

## Phạm vi thay đổi

### XOÁ
- `app/native/` (toàn bộ: actor-go, dotnet, go, hono, host-go, hot-rust, java, python, rust).
- `src/backends/http.ts` (gọi sidecar Go/Rust qua HTTP).
- `src/proof_native.ts` (proof memory/Go/Rust).
- `src/hot/search.ts` (`createRustSearch` — adapter Rust compute).
- `docs-site/src/content/docs/guides/switch-backend.mdx` (cả guide).
- Scripts polyglot nếu có (`scripts/run-native.sh`, phần bench go/rust).

### SỬA (engine)
- `src/core/resolver.ts`: `BackendKind = "memory" | "sqlite" | "postgres"`; bỏ nhánh http +
  `endpoints` + transport; `BackendResolution = { language: BackendKind }` (luôn in-process).
  Giữ `cellBackends` (vẫn cho per-cell override giữa các driver TS). Giữ `RenderMode` (static/island).
- `src/core/wiring.ts`: `buildBackend` chỉ memory/sqlite/postgres; bỏ import `createHttpBackend`.
- `src/core/codegen.ts`: bỏ `genGo`/`genRust`, giữ `genTs`. Cập nhật comment "polyglot".
- `src/core/cli.ts`: `gen` desc → "Codegen contract → types TS"; gỡ lệnh/native liên quan go/rust.
- `src/core/panel.ts`: bỏ badge go/rust + cột transport/endpoint (in-process là mặc định duy nhất).
- `src/react/DebugBar.tsx` + `src/core/client.ts`: bỏ live backend swap go/rust (`_devBackend`).
- `src/server_factory.ts`: gỡ tham chiếu go/rust (header/live-swap/x-fluxe backend lang).
- `app/profiles.ts`: chỉ giữ `dev: { backend: "memory" }` (+ tuỳ chọn sqlite/postgres profile).
  Bỏ `prod-go`/`prod-rust`/`mixed`.
- `src/selftest2.ts`: cập nhật profile (memory/sqlite) thay vì go — vẫn chứng minh
  "cùng cell, 2 profile → 2 manifest" nhưng giữa các driver TS.

### SỬA (test — gỡ case go/rust, giữ xanh)
`resolver.test.ts`, `wiring.test.ts`, `codegen.test.ts`, `panel.test.ts`, `cli.test.ts`,
`config.test.ts`. Mỗi case go/rust → đổi sang sqlite/postgres hoặc xoá. Mục tiêu: `test:all` xanh.

### SỬA (docs)
- Xoá `guides/switch-backend.mdx`; gỡ khỏi sidebar `astro.config.mjs`.
- `guides/rca.md`: 5 trục → render + data (bỏ language/transport polyglot).
- `guides/features.md`: bỏ mục "Switch backend" polyglot + "Codegen polyglot" → "Codegen TS".
  Bảng "Chưa hỗ trợ": gỡ dòng `createRustSearch` stub.
- `reference/codegen.md`, `reference/data.md`, `reference/devtools.md` (live-swap), `cli.md`,
  `guides/tutorial.mdx`, `index.mdx`: gỡ mọi nhắc go/rust/sidecar/switch-backend.

### SỬA (CLAUDE.md)
- Mục "Ranh giới": bỏ `app/native/` = service polyglot.
- Mục "Kết hợp Rust/native": rút gọn thành ghi chú lịch sử "đã đo, quyết định KHÔNG polyglot —
  fluxe là single-runtime TS" (giữ bài học napi-rs làm chứng cứ, bỏ hướng dẫn tích hợp).
- Bảng switch-backend trong mục docs-sync: bỏ.

## Không đụng (giữ nguyên)
- Core `node:http`, React SSR, render cache, container (0.5.0), jobs/sqlite, storage, i18n, config,
  auth, realtime (broker/presence — in-process TS), seo, codegen TS.

## Data flow sau thay đổi
Cell `defineCell` → loader nhận `backend` (memory|sqlite|postgres, in-process) → trả props →
SSR. Không còn roundtrip sidecar; `backend` luôn là instance TS in-process. Resolver chỉ quyết
**render mode** + **driver data nào**.

## Rủi ro & cách kiểm
- Vỡ test do union hẹp lại → sửa từng test file, `npm run test:all` là gate sau mỗi phase.
- Sót tham chiếu go/rust → `grep -rE "\b(go|rust|java|dotnet|sidecar|polyglot)\b" src/ docs-site/`
  cuối cùng phải sạch (trừ false-positive `go()` navigation).
- Docs lệch code → quét lại theo bảng docs-sync của CLAUDE.md.

## Thứ tự thực thi (phase, gate = test:all xanh)
1. Engine core: resolver + wiring + types → test:all.
2. Codegen/CLI/panel/DebugBar/client/server_factory → test:all.
3. Xoá file (app/native, http.ts, proof_native, hot/search) + profiles + selftest2 → test:all.
4. Docs + CLAUDE.md + astro sidebar.
5. Quét grep sạch + release minor (breaking nội bộ nhẹ, nhưng API user `defineCell` không đổi → minor).

## Phi mục tiêu
- Không viết lại core trên framework ngoài.
- Không bỏ các backend TS (sqlite/postgres) trừ khi user yêu cầu.
- Không đổi API user-facing (`defineCell`, ctx.backend) — chỉ thu hẹp tập giá trị backend.
