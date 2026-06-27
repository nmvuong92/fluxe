# Contract v2 — builder + inference (bỏ string DSL & codegen)

**Ngày:** 2026-06-27
**Trạng thái:** chốt qua thảo luận, redesign contract 0.10.0. Net BỚT code.

## Vì sao

String type-expr (`"Todo[]"`, `"string?"`) là điểm DX yếu nhất: type chỉ có sau `fx gen`; ref typo
lọt tới lúc gen; composition (array/optional/union) làm parser phình; error khó đọc. Builder +
inference (Zod/tRPC model) cho **type tức thì tại compile-time, ref-checked, composable** — và cho
phép **bỏ codegen hoàn toàn**.

## Quyết định

1. **Builder = Zod + lớp `f` sugar mỏng** (fluxe đã depend Zod). `f.string/int/bool`, `f.object`,
   `f.union`, `f.query(out)`, `f.mutation(in, out)`, `f.contract({...})`. Composition dùng method Zod
   (`.array()`, `.optional()`).
2. **Bỏ codegen HOÀN TOÀN** (tRPC-style):
   - Types: `Infer<typeof X>` / `z.infer` — tức thì, 0 gen.
   - Validators: schema CHÍNH LÀ validator (Zod) — 0 gen.
   - Server dispatch: engine đọc contract object lúc chạy — 0 gen.
   - Client: `createClient<typeof contract>()` = JS Proxy typed bằng infer — 0 gen, **0 schema xuống browser**.
3. **Xoá:** string `defineContract`/`tsType`/`genContractTypes`/`genZod`/`genServer`/`genClient`,
   `scripts/codegen.ts` (contract), `.fluxe/gen`, `fx gen` (contract), `prepare` hook, watch-gen trong
   `scripts/dev.ts`, `opts.validators`.
4. **Giữ:** runtime `/__rpc/<op>` (đọc contract trực tiếp: validate input qua `op.input`, CSRF nếu
   `kind==="mutation"`), `opts.resolvers` (fallback `backend`), `rpcCall`. Lớp THÊM, `actions/rpc` cũ nguyên.

## API (src/core/contract.ts viết lại)

```ts
import { z, type ZodTypeAny, type ZodRawShape } from "zod";

export const f = {
  string: z.string(), int: z.number().int(), bool: z.boolean(), number: z.number(), null: z.null(),
  object: <T extends ZodRawShape>(s: T) => z.object(s),
  union: <T extends readonly [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>(...o: T) => z.union(o as any),
  query: <O extends ZodTypeAny>(output: O) => ({ kind: "query", output } as const),
  mutation: <I extends ZodRawShape | ZodTypeAny, O extends ZodTypeAny>(input: I, output: O) =>
    ({ kind: "mutation", input: (input instanceof z.ZodType ? input : z.object(input as ZodRawShape)), output } as const),
  contract: <C extends Contract>(ops: C) => ops,
};
export type Infer<T extends ZodTypeAny> = z.infer<T>;

export type OpDef = { kind: "query"; output: ZodTypeAny } | { kind: "mutation"; input: ZodTypeAny; output: ZodTypeAny };
export type Contract = Record<string, OpDef>;

type OpFn<D> = D extends { input: infer I extends ZodTypeAny; output: infer O extends ZodTypeAny }
  ? (input: z.infer<I>) => Promise<z.infer<O>>
  : D extends { output: infer O extends ZodTypeAny } ? () => Promise<z.infer<O>> : never;
export type Resolvers<C extends Contract> = { [K in keyof C]: OpFn<C[K]> };
export type Client<C extends Contract> = { [K in keyof C]: OpFn<C[K]> };
```

`createClient` (client-side, dùng rpcCall) — đặt trong `src/core/client.ts`, export ở `/client`:
```ts
export function createClient<C extends Contract>(): Client<C> {
  return new Proxy({}, { get: (_t, op: string) => (input?: unknown) => rpcCall(op, input) }) as Client<C>;
}
```

## Runtime (src/core/rpc.ts đơn giản hơn)

`handleRpc({ url, req, res, cookies, resolvers, contract, readBody })`:
- op = contract[name]; lạ → 404.
- kind==="mutation" → CSRF double-submit (403 nếu sai).
- "input" in op → `validateInput(op.input, body)` (Zod, 400 field-level).
- `resolvers[name](input)` → JSON. Bỏ `validators` param.

## makeServer opts

`{ contract?: Contract; resolvers?: unknown }` (bỏ `validators`). `backend` giữ cho cells.

## Demo

- `app/contract.ts`: `f` builder + `export type AppContract = typeof contract`.
- `app/backend/index.ts`: `export const resolvers: Resolvers<typeof contract> = {...}`.
- `app/backend/server.ts`: inject `{ contract, resolvers }` (bỏ validators import).
- view (client): `import type { AppContract } from "../../contract"; const api = createClient<AppContract>();` (type-only → 0 zod xuống browser).
- selftest2: bỏ import `.fluxe/gen/validators`; pass `{ contract, resolvers }`.

## Dọn dẹp

- `scripts/codegen.ts` → xoá (hoặc về genTS-only nếu còn dùng — kiểm). `fx gen` desc → bỏ/đổi.
- `scripts/dev.ts`: bỏ phần watch chạy codegen; giữ `tsx --watch` server (hot-reload code vẫn tốt).
- `package.json`: bỏ `prepare` (gen). `sync.ts`: bỏ hook codegen.
- `.fluxe/gen` không còn dùng.

## Testing (gate test:all xanh)

- `f` builder: `f.query/mutation/object` ra OpDef đúng (kind/input/output là ZodType). Infer types compile.
- runtime `/__rpc`: query không CSRF → out · mutation thiếu CSRF → 403 · input sai → 400 · op lạ → 404
  (đọc contract trực tiếp, không validators param).
- e2e selftest2: contract thật + resolvers → /__rpc/todos, /__rpc/addTodo (Zod 400, CSRF 403).
- type-level: `Resolvers<typeof contract>` ép resolvers đúng kiểu (compile-fail nếu sai) — 1 test typecheck.
- behavior-preserving: actions/rpc cũ xanh.

## Phi mục tiêu
- Không SDK-codegen cho consumer ngoài (optional tương lai).
- Không field-selection/subscriptions/batch (như v1).

## Thứ tự (phase, gate test:all)
1. `src/core/contract.ts` viết lại (`f` + types) + unit; `createClient` trong client.ts.
2. `rpc.ts` đọc contract trực tiếp (bỏ validators) + rpc.test cập nhật.
3. server_factory opts (bỏ validators) + barrel export `f`, `createClient`.
4. Demo: contract/resolvers/server/view + selftest2 + xoá .fluxe/gen import.
5. Dọn codegen/dev/sync/prepare/package.
6. Docs reference/contract.md viết lại (builder, 0 gen, Proxy) + features; release minor.
