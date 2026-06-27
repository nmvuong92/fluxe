# Contract-aware client DX — design

> Roadmap fluxe-dx-roadmap: forms · subscriptions · data-layer · devtools.
> Mục tiêu: DX cực tốt, develop nhanh — tất cả **bind vào contract một lần** (như tRPC),
> giữ ràng buộc cốt lõi: **contract import type-only ở client → 0 Zod schema xuống browser**.

## Spine: `createHooks<typeof contract>()`

Factory mirror `createClient`/`createCells`. Trả Proxy: mỗi property = op name → object hook
phù hợp **kind** của op (suy bằng conditional type trên `C[K]`):

```ts
const api = createHooks<typeof contract>();   // @nmvuong92/fluxe/react
api.todos.useQuery()                          // query  → { data, error, loading, refetch }
api.addTodo.useMutation(opts)                 // mutation → { mutate, loading, error }
api.addTodo.useForm(opts)                     // mutation → form state + per-field errors
api.feed.useSubscription(cb)                  // subscription → live (SSE)
```

Op name (string) + types đủ để gọi `/__rpc/<op>` — KHÔNG cần schema runtime ở client.

## R1 (0.15.0) — Data layer + Forms

### useQuery (contract-aware)
- Auto-key = `op + JSON(input)`. Bọc `useQuery` cũ (cache/dedup/tracing) nhưng typed từ contract.
- `api.todos.useQuery(input?, { initial?, enabled? })` → output typed.

### useMutation (contract-aware)
- `api.addTodo.useMutation({ invalidates?, optimistic? })`:
  - `invalidates: (keyof C)[]` → sau success, xoá cache + refetch các query op đó (đăng ký active queries trong 1 registry module-level).
  - `optimistic?: (input) => void | rollback` → optimistic update (đã có `mutate()` core).
- Trả `{ mutate, loading, error }`, input/output typed.

### useForm (server-validated, hợp "0 schema to browser")
- `api.addTodo.useForm({ onSuccess?, initial? })`:
  - `register(field)` → `{ name, value, onChange }` (field name typed = keyof input).
  - `handleSubmit(e)` → gọi mutation; nếu 400 `code=validation`, map `details[].path` → `errors[field]`.
  - `{ values, errors, submitting, submit, register, reset }`.
- Escape hatch tuỳ chọn `{ schema }` (user CHỦ ĐỘNG ship 1 zod schema) → validate client trước submit.
- Single source of truth = server Zod; form chỉ surface lỗi theo field.

## R2 (0.16.0) — Subscriptions
- `f.subscription(output)` → `OpDef { kind:"subscription"; output }`.
- Server: `/__rpc/<op>` khi op.subscription → mở SSE, push qua broker topic (`op` hoặc resolver tự publish). Resolver subscription = async generator hoặc `(emit) => unsubscribe`.
- Client: `api.feed.useSubscription((data) => …)` bọc `subscribe()` core (EventSource). Typed output.

## R3 (0.17.0) — Live RCA DevTools
- Nâng `<DebugBar>`: panel live show contract ops (query/mutation/subscription), cache state,
  in-flight, resolution + serverMs/clientMs (đã log qua `debug` store + `lastRpcMeta`).
- 0 dependency mới; chỉ mở rộng store + UI.

## Ràng buộc
- Mọi ví dụ docs import `@nmvuong92/fluxe/react` (không lộ src).
- Hooks cũ (`useQuery`/`useMutation` string-based) GIỮ NGUYÊN — factory là lớp THÊM typed.
- Config param mới (nếu có) → `FLUXE_*` ENV + documented.
- Mỗi R: implement → `npm run test:all` xanh → docs → release minor.
