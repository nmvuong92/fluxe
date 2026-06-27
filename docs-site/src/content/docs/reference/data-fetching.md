---
title: Data fetching
description: useQuery, useMutation, rpc client, repro→test.
sidebar:
  order: 40
---

## Định nghĩa

Trong fluxe, **cell island** lấy dữ liệu từ server bằng cách gọi **action** qua `rpc()`. Hai hook
`@nmvuong92/fluxe/react` bọc `rpc()` để cho DX "chỉ khai báo là xong":

- **`useQuery`** — react-query-lite: cache theo key, **dedup in-flight** (chống refetch storm),
  trạng thái `loading/error/data`, `refetch`, tự log tracing (resolution + timing) vào DebugBar.
- **`useMutation`** — gọi action ghi dữ liệu, log input + resolution + timing, lỗi có cấu trúc.

Cả hai dựa trên `rpc()`, hàm này ném `RpcError` **có cấu trúc**
(`code`/`status`/`details`) khi server trả lỗi — nên UI bắt được đúng loại lỗi thay vì chuỗi mơ hồ.

```ts
import { useQuery, useMutation } from "@nmvuong92/fluxe/react";
```

## Cơ chế trong fluxe

- **`rpc()`** POST tới action, tự đính `x-csrf-token`, đo thời gian client/server và đọc resolution
  từ response header (để DebugBar hiển thị). Khi server trả lỗi, nó ném `RpcError` với
  `code`/`status`/`details` (parse từ body `{error:{code,message,details}}`); mất kết nối → `RpcError`
  code `network`.
- **`useQuery`** cache kết quả theo `key` và **dedup in-flight**: nếu đã có một fetch cùng `key` đang
  bay thì dùng chung promise đó, không bắn request mới. `opts.initial` cho phép hydrate từ data SSR →
  không "nhấp nháy" loading lần đầu.
- **`useMutation`** gọi action ghi dữ liệu, quản lý `loading`/`error`, và khi lỗi ưu tiên
  `details[0].message` (thông điệp field đầu tiên từ validation) trước khi rơi về `message`.

## Ví dụ

Cell `todos` (island) dùng `useQuery` làm nguồn sự thật, `useMutation` cho add/toggle, và
realtime để revalidate khi client khác đổi:

```tsx
// app/cells/todos/view.tsx
const q = useQuery<Todo[]>("todos", () => rpc("todos", "list", {}), { initial: data.todos });
const add = useMutation("todos.add", (t: string) => rpc<Todo>("todos", "add", { title: t }));
const toggle = useMutation("todos.toggle", (id: string) => rpc<Todo[]>("todos", "toggle", { id }));
const todos = q.data ?? [];

// Realtime: client khác đổi → revalidate.
useEffect(() => subscribe("todos", () => q.refetch()), []);

async function onAdd() {
  try { await add.mutate(title); setTitle(""); q.refetch(); } catch { /* lỗi đã ở add.error */ }
}
```

Bắt lỗi có kiểu (sau `rpc`/`mutate`):

```ts
try { await rpc("hello", "x", {}); }
catch (e) { /* e.code, e.status, e.details — xem Errors */ }
```

## API

```ts
// @nmvuong92/fluxe/react
useQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { initial?: T; enabled?: boolean },
): { data?: T; error: string; loading: boolean; refetch: () => Promise<void> }

useMutation<I, O>(
  label: string,
  fn: (input: I) => Promise<O>,
): { mutate: (input: I) => Promise<O | undefined>; loading: boolean; error: string }

// @nmvuong92/fluxe/client
rpc<T>(cell: string, action: string, input: unknown): Promise<T>   // POST /__action/…, ném RpcError
class RpcError extends Error { code: string; status: number; details?: unknown }
mutate<T>({ optimistic?, run, rollback? }): Promise<T>             // optimistic + rollback khi lỗi
revalidate(): Promise<{ cell; data }>                             // refetch props trang hiện tại
subscribe(topic, onData): () => void                             // realtime qua SSE
```

## Lưu ý

- `cache`/`inflight` của `useQuery` là **module-level** (`Map` toàn cục) — key dùng chung giữa các
  component cùng `key`. Đây là cái cho phép dedup, nhưng nghĩa là 2 nơi cùng `key` chia sẻ cùng data.
- `useEffect` của `useQuery` chỉ refetch khi `key` đổi (deps `[key]`); đổi `fetcher` không tự refetch
  (đã giữ qua `fetcherRef`). Muốn nạp lại thủ công → gọi `refetch()`.
- `useMutation` ưu tiên `e.details?.[0]?.message` → lỗi validation hiện thông điệp field đầu tiên.
  Xem [Validation](/reference/validation/) và [Errors](/reference/errors/).
- `rpc()` tự đính `x-csrf-token` (xem [CSRF](/reference/csrf/)) — không cần làm gì thêm khi dùng hook.
