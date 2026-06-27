---
title: Data fetching
description: createHooks (contract-aware) — useQuery/useMutation/useForm typed; primitives useQuery/useMutation string-based; rpc client.
sidebar:
  order: 40
---

## Định nghĩa

Cell **island** lấy/ghi dữ liệu qua **contract** (`/__rpc/<op>`). `createHooks<typeof contract>()`
bind hook React vào contract **một lần** (như `createClient`) — typed tức thì, op name đủ để gọi
(**KHÔNG** schema xuống browser).

```ts
// app/api.ts — client-safe: contract import TYPE-ONLY → 0 zod xuống browser
import { createHooks } from "@nmvuong92/fluxe/react";
import type { AppContract } from "./contract";
export const api = createHooks<AppContract>();
```

Mỗi op → hook hợp **kind**:

| Op kind | Hook | Trả về |
|---------|------|--------|
| `query` | `api.todos.useQuery(opts?)` | `{ data, error, loading, refetch }` (typed output) |
| `mutation` | `api.addTodo.useMutation(opts?)` | `{ mutate, loading, error }` |
| `mutation` | `api.addTodo.useForm(opts?)` | form state + per-field errors |

## useQuery — cache + dedup + invalidate

- Cache theo op, **dedup in-flight** (chống refetch storm), `loading/error/data`, `refetch`, tự log
  tracing (resolution + timing) vào DebugBar.
- `opts.initial` hydrate từ data SSR → không "nhấp nháy" loading lần đầu.

## useMutation — optimistic + invalidate

```ts
const toggle = api.toggleTodo.useMutation({
  invalidates: ["todos"],                       // refetch query op `todos` sau success
  optimistic: (input) => { /* … */ return () => { /* rollback khi lỗi */ }; },
});
await toggle.mutate({ id });
```

`invalidates` gọi `invalidateQueries([...])` (xoá cache + refetch mọi `useQuery` đang mount khớp op).
`optimistic(input)` chạy ngay, trả hàm **rollback** (gọi nếu mutation lỗi).

## useForm — type-safe, server-validated

Field name suy từ input op (typed). Nguồn-sự-thật validation = **server (Zod)**: submit → nếu 400
`code=validation`, map `details[].path` → `errors[field]` (giữ "0 schema xuống browser"). Tuỳ chọn
`{ schema }` để validate client trước submit.

```tsx
// app/cells/todos/view.tsx
const q = api.todos.useQuery({ initial: data.todos });
const form = api.addTodo.useForm({ invalidates: ["todos"], onSuccess: () => form.reset() });
const toggle = api.toggleTodo.useMutation({ invalidates: ["todos"] });

useEffect(() => subscribe("todos", () => q.refetch()), []);   // realtime → refetch

const title = form.register("title");
return (
  <form onSubmit={form.handleSubmit}>
    <input {...title} placeholder="Việc mới..." />
    {form.errors.title ? <p className="err">{form.errors.title}</p> : null}
    <button type="submit" disabled={form.submitting}>Thêm</button>
  </form>
);
```

## Primitives (string-based)

`createHooks` bọc 2 hook cấp thấp — dùng trực tiếp khi không qua contract (vd action `/__action`):

```ts
useQuery<T>(key, fetcher, opts?)              // key thủ công + fetcher bất kỳ
useMutation<I,O>(label, fn)                    // fn bất kỳ (vd rpc("cell","action",input))
invalidateQueries(keys: string[])             // xoá cache + refetch query khớp (exact | prefix `op:`)
```

## API

```ts
// @nmvuong92/fluxe/react
createHooks<C>(client?): Hooks<C>             // api.<op>.useQuery/useMutation/useForm
api.<query>.useQuery(opts?: { initial?; enabled? }): { data?; error; loading; refetch }
api.<mutation>.useMutation(opts?: { invalidates?; optimistic?; onSuccess? }): { mutate; loading; error }
api.<mutation>.useForm(opts?: { initial?; onSuccess?; onError?; schema?; invalidates? }): FormApi
// FormApi: { values, errors, formError, submitting, register, setValue, handleSubmit, reset }
invalidateQueries(keys: string[]): void

// @nmvuong92/fluxe/client
createClient<C>(): Client<C>                   // await api.todos() — POST /__rpc/<op>, Proxy typed
rpc<T>(cell, action, input): Promise<T>        // POST /__action/…, ném RpcError
class RpcError extends Error { code; status; details? }
mutate<T>({ optimistic?, run, rollback? }): Promise<T>
subscribe(topic, onData): () => void           // realtime qua SSE
```

## Lưu ý

- `cache`/`inflight`/registry của `useQuery` là **module-level** — query cùng key chia sẻ data; đó là
  cái cho phép dedup + `invalidateQueries` refetch live mọi component đang mount.
- `useForm` không ship Zod xuống browser: validation sâu là **server**. Muốn validate client → truyền
  `{ schema }` (user chủ động ship 1 zod). Xem [Validation](/reference/validation/), [Errors](/reference/errors/).
- CSRF là việc của **host** (middleware mount trước fluxe). Engine `/__rpc`/`/__action` không tự kiểm.
