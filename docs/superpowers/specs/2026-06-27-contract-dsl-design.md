# Contract DSL — khai báo nghiệp vụ cell↔backend, codegen tự động

**Ngày:** 2026-06-27
**Trạng thái:** spec chốt qua brainstorm (§1–3 + auto-gen đã duyệt), chờ user review → plan.

## Mục tiêu

fluxe cung cấp một **CONTRACT mạnh giữa cell ↔ backend** phủ toàn bộ nghiệp vụ web (không chỉ
CRUD/DB). Dev khai báo operations (queries/mutations) + types tại **`app/contract.ts`** (TS-object,
zero-dep, type-safe); `fx gen` **tự sinh** types + Zod validators + client `api` có kiểu + server
`Resolvers` interface + dispatcher `/__rpc`. **DB/sqlite/pg ẩn trong resolver** — contract không biết.
Codegen là **magic tự chạy** trong pipeline dev/build — dev không bao giờ gõ `fx gen` tay.

## Quyết định (chốt qua brainstorm)

1. **Format = TS-object schema** (mở rộng `app/contract.ts`). Không parser/DSL text. Type-expr là
   string: scalar (`"string"|"int"|"bool"`), ref type (`"Todo"`), mảng (`"Todo[]"`), optional (`"string?"`).
2. **Runtime = lớp RPC độc lập (tRPC-style)**: operations là namespace phẳng, tách khỏi cell, phục
   vụ tại `POST /__rpc/<op>`. KHÔNG gắn per-cell.
3. **`api` hai mặt, cùng kiểu (sinh từ 1 contract):** server (`gen/server`) gọi resolvers **in-process
   0 hop** (dùng trong loader/Express route); client (`gen/client`) gọi qua `fetch /__rpc` **1 hop**
   (dùng trong view/island). Client hop là bắt buộc (mọi web framework), giảm tác động bằng SSR
   loader (lần đầu 0 hop) + optimistic + SSE push.
4. **Resolvers tiêm qua `{ backend }` sẵn có** (resolvers CHÍNH LÀ backend nghiệp vụ) — không thêm
   tham số makeServer mới.
5. **CSRF:** mutation cần CSRF (như action); query bỏ qua (đọc thuần). Validate input bằng Zod sinh ra
   → sai → `FluxeError 400` field-level.
6. **Auto-gen:** `fx gen` chạy trong bước `sync` (mọi dev/resolve/build tự gọi) + watch `app/contract.ts`
   khi `fx dev` (regen + hot reload) + npm `prepare` hook. `.fluxe/gen/*` là artifact gitignore.
7. **Lớp THÊM, behavior-preserving:** `actions`/`rpc`/`withInput` cũ vẫn chạy nguyên.

## Hình dạng contract (app/contract.ts)

```ts
import { defineContract } from "@nmvuong92/fluxe";
export const contract = defineContract({
  types:     { Todo: { id: "string", title: "string", done: "bool" } },
  queries:   { todos: { out: "Todo[]" }, order: { in: { id: "string" }, out: "Order?" } },
  mutations: { addTodo: { in: { title: "string" }, out: "Todo" }, checkout: { in: { cartId: "string" }, out: "Order" } },
});
```

## fx gen sinh gì (`.fluxe/gen/`)

| File | Nội dung |
|------|----------|
| `types.ts` | interface cho mỗi `type` + input/output mỗi op (mở rộng `genTS`) |
| `validators.ts` | Zod schema cho `in` mỗi op (validate runtime) |
| `server.ts` | `interface Resolvers` (chữ ký op để backend implement) + `createApi(resolvers)` (server `api`, gọi thẳng resolvers) |
| `client.ts` | `api` có kiểu: `api.todos()`, `api.addTodo({title})` → `rpc /__rpc/<op>` |

## Components (file)

- `src/core/contract.ts` — `defineContract(schema)`; parse type-expr (`[]`,`?`,ref); `genTypes` (mở
  rộng codegen hiện tại), `genZod`, `genServer`, `genClient` (string-in/string-out, thuần, dễ test).
- `src/core/rpc.ts` — runtime `/__rpc/<op>`: tra op → validate (Zod) → CSRF nếu mutation → gọi
  `resolvers[op](input, ctx)` → JSON. Tích hợp vào `createHandler` (server_factory).
- `scripts/codegen.ts` — gọi gen từ `app/contract.ts` → ghi `.fluxe/gen/*`. Đã có cho types; mở rộng.
- `scripts/sync.ts` — thêm bước chạy contract codegen (auto mỗi dev/resolve/build).
- `src/core/cli.ts` — `fx dev` watch `app/contract.ts`; `fx gen` mô tả "contract → types+zod+client+server".
- `app/contract.ts` (demo) — types + queries + mutations.
- `app/backend/index.ts` (demo) — `export const backend: Resolvers = {...}` (resolvers; DB ẩn).
- Barrel: export `defineContract`.
- Subpath `@nmvuong92/fluxe/client/api`? — client api import. (Xác định lúc plan: re-export gen, hoặc
  doc import thẳng `.fluxe/gen/client`.)

## Data flow

1. Dev sửa `app/contract.ts` → save.
2. (watch) `fx gen` regen `.fluxe/gen/{types,validators,server,client}.ts` → hot reload.
3. loader (server): `import { api } from ".fluxe/gen/server"` → `await api.todos()` (0 hop).
4. view (client): `import { api } from ".fluxe/gen/client"` → `api.addTodo({title})` → `POST /__rpc/addTodo`.
5. `createHandler` nhận `POST /__rpc/addTodo` → validate Zod → CSRF (mutation) → `backend.addTodo(input)` → JSON.

## Error handling

- Op không tồn tại → 404. Input sai → 400 field-level (Zod). Mutation thiếu CSRF → 403.
- Resolver ném domain `FluxeError` → status/code; unexpected → 500 + errorId (không leak prod).
- Thiếu `.fluxe/gen/*` (chưa gen) → `fx dev`/`sync` sinh trước khi chạy; npm `prepare` cho clone mới.

## Testing (gate test:all xanh)

- **codegen thuần:** contract → types/zod/server/client đúng chuỗi (unit, string-in/out).
- **runtime:** mock `Resolvers` → `/__rpc/op` trả output · input sai → 400 · mutation thiếu CSRF → 403 ·
  query bỏ CSRF · op lạ → 404.
- **integration:** `api` server (0 hop) và client (rpc) cùng contract → cùng kiểu/kết quả.
- **behavior-preserving:** actions/rpc cũ vẫn xanh.

## Phạm vi v1 / Phi mục tiêu

| v1 | Roadmap (KHÔNG v1) |
|----|--------------------|
| types · queries · mutations | subscriptions (đã có SSE riêng) |
| codegen types·zod·server·client | field-selection kiểu GraphQL (lấy nguyên output) |
| `/__rpc/<op>` + validate + CSRF(mutation) | batch nhiều op/1 hop (chừa chỗ, thêm sau) |
| type-expr scalar·`T[]`·`T?`·ref | nested resolver graph · auth-per-field |
| auto-gen (sync/watch/prepare) | persisted queries · caching layer |

## Thứ tự thực thi (phase, gate test:all)

1. `src/core/contract.ts`: `defineContract` + type-expr parse + genTypes/genZod/genServer/genClient + unit.
2. `src/core/rpc.ts` + tích hợp `createHandler` (`/__rpc`) + runtime test.
3. `scripts/codegen.ts` + `scripts/sync.ts` auto-gen + `fx dev` watch + npm `prepare`.
4. Demo: `app/contract.ts` + `app/backend/index.ts` resolvers + cell todos dùng `api` + integration test.
5. Docs: `reference/contract.md` (DSL + gen + /__rpc) + reframe `reference/data.md` (DB = chi tiết, ẩn sau resolver) + features + CLAUDE.md.
6. Release minor.
