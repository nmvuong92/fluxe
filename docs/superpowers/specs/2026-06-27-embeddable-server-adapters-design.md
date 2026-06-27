# fluxe embeddable — adapter Express / Hono / Nest

**Ngày:** 2026-06-27
**Trạng thái:** spec chốt qua brainstorm, chờ build.

## Mục tiêu

User chọn framework server (Express / Hono / Nest) cho app của họ; fluxe nhúng vào như một
handler. Engine tách `createHandler` framework-agnostic (Node `(req,res)`) + ship 3 adapter
subpath. Demo mặc định = **Express TS**. Core giữ zero-dep (framework = peerDependency).

## Quyết định (chốt)

1. **1 spine Node** `createHandler(...): (req,res)=>Promise<void>`. Cả 3 adapter wrap chung nó
   (Express/Nest dùng req/res Node; Hono qua `@hono/node-server` cũng req/res Node). KHÔNG bản Web-fetch.
2. `makeServer` GIỮ NGUYÊN, refactor thành `http.createServer(createHandler(...))` — behavior-preserving.
3. Adapter = subpath `@nmvuong92/fluxe/{express,hono,nest}`; framework + `@hono/node-server` là
   **peerDependency** của package (optional), không phải dep core.
4. **Server entry = `app/server.ts` (user-owned)**, giống `app/backend.ts`. Default = Express mount fluxe.
   `makeServer` vẫn dùng cho selftest2 + ai cần zero-config.
5. **Mount catch-all**: host gắn route/middleware riêng trước, fluxe xử phần còn lại (cells,
   `/__action`, `/__sse`, `/_fluxe`, `/__upload`, `/__file`, `/login`, `/logout`, `/client.js`,
   `/sitemap.xml`, `/robots.txt`). Route lạ → fluxe trả 404 (không gọi next; mount sau cùng).
6. `fx init --server express|hono|nest` (default express) sinh `app/server.ts`.

## Kiến trúc

```
                ┌─ createHandler(manifest, cells, layouts, opts) → (req,res)=>Promise<void>
engine core ────┤   (toàn bộ logic request hiện ở server_factory.ts:113)
                └─ makeServer(...) = http.createServer(createHandler(...))   // zero-config

@nmvuong92/fluxe/express → fluxe(...)=Express middleware (req,res,next)
@nmvuong92/fluxe/nest    → FluxeMiddleware (NestMiddleware bọc cùng handler)
@nmvuong92/fluxe/hono    → serveFluxe(...) qua @hono/node-server
```

## Components (file)

- `src/server_factory.ts` — tách `createHandler` (export); `makeServer` bọc lại. Behavior-preserving.
- `src/adapters/express.ts` → `export function fluxe(manifest, cells, layouts, opts): RequestHandler`
  (gọi handler; bắt lỗi → next(err) tuỳ chọn). peerDep `express`.
- `src/adapters/hono.ts` → `export function serveFluxe(app, manifest, cells, …, { port })`
  hoặc middleware Hono dùng `@hono/node-server`. peerDep `hono`, `@hono/node-server`.
- `src/adapters/nest.ts` → `FluxeMiddleware` (class implements NestMiddleware) + helper module.
  peerDep `@nestjs/common`.
- `package.json` exports: thêm `./express`, `./hono`, `./nest` (lib + src paths như subpath khác);
  `peerDependencies` + `peerDependenciesMeta` (optional) cho express/hono/@hono-node-server/nestjs.
- `app/server.ts` (demo, user-owned) — Express app mount fluxe (default). Thay `src/server.tsx`
  làm entry `fx dev`? → giữ `src/server.tsx` (node:http) cho test; thêm `app/server.ts` Express là
  đường demo "khuyên dùng" + tài liệu. `fx dev` chạy `app/server.ts` nếu tồn tại, fallback server.tsx.
- `scripts/init.ts` — scaffold `app/server.ts` theo `--server`.

## Data flow

`fx dev` → `app/server.ts`: `const app = express(); app.use(fluxe(manifest, cells, layouts, { backend, … })); app.listen(PORT)`.
Request → Express middleware chain (host routes trước) → `fluxe()` middleware → `createHandler` →
cell/action/SSR như cũ. fluxe không biết nó đang trong Express/Hono/Nest.

## Error handling

- Adapter bắt lỗi từ handler; Express → `next(err)` để host error middleware xử (tuỳ chọn), mặc
  định fluxe đã tự `sendError`. Hono/Nest tương tự — handler đã tự trả lỗi có cấu trúc.
- peerDep thiếu → import subpath ném lỗi rõ ("cài express để dùng @nmvuong92/fluxe/express").

## Testing

- `createHandler` không vỡ: `test:all` (selftest2 + unit) giữ xanh sau refactor (behavior-preserving).
- Mỗi adapter 1 integration test: boot framework thật mount fluxe → GET cell (200 + HTML) + POST
  `/__action` (200). express/hono/nest + @hono/node-server cài **devDependency** để test.
- Test gate: `npm run test:all` xanh.

## Packaging / build

- `tsconfig` paths + `package.json` exports thêm 3 subpath (src local / lib published).
- `peerDependenciesMeta.*.optional = true` → `npm i @nmvuong92/fluxe` không kéo framework.
- `prepublishOnly` build lib gồm adapters.

## Phi mục tiêu

- KHÔNG bản Web-fetch/edge (fluxe Node-bound: node:sqlite/crypto/http/jobs).
- KHÔNG rewrite core lên Express/Hono/Nest — chỉ NHÚNG vào.
- KHÔNG bỏ `makeServer`/`node:http`.

## Thứ tự thực thi (phase, gate test:all)

1. Tách `createHandler` + `makeServer` bọc lại → test:all (behavior-preserving).
2. Adapter Express + `app/server.ts` demo + integration test → test:all.
3. Adapter Hono + Nest + integration test → test:all.
4. package.json exports + peerDeps + tsconfig paths + fx init scaffold.
5. Docs: guide chọn server framework + 3 snippet (default Express) + reference; CLAUDE.md ranh giới.
6. Release minor.
