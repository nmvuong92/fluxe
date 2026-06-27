---
title: Typed errors
description: FluxeError — lỗi là giá trị có kiểu (Tenet T5).
sidebar:
  order: 11
---

## Định nghĩa

**Tenet T5: lỗi là giá trị có kiểu**, không phải `throw` mơ hồ. `FluxeError` mang đủ `code` /
`status` / `message` / `details` để biên request map thẳng ra HTTP an toàn cho client.

fluxe chia lỗi làm hai tầng. **Domain error** (`FluxeError`) là lỗi nghiệp vụ có chủ đích —
giữ nguyên status/code/message/details cho client. **Unexpected error** (mọi `Error` khác) là bug
ngoài dự kiến → ép về `500` + một `errorId` (UUID); ở production **không leak** stack/detail, chỉ
trả `errorId` để tra log. Đây là cách chặn rò thông tin nội bộ mà vẫn debug được.

## Cơ chế

`FluxeError` chỉ là một `Error` cộng thêm `code` / `status` / `details` (vd `details` là danh sách
lỗi field của validation). Bạn `throw new FluxeError(code, message, status, details)` ở loader/action
khi muốn trả lỗi nghiệp vụ có chủ đích.

Engine tự lo phần còn lại: biên request bọc toàn bộ trong `try/catch` nên **một lỗi không làm sập
server**. Mỗi lỗi đi qua một bộ chuyển payload — `FluxeError` được giữ nguyên `status`/`code`/`message`
/`details`; mọi `Error` khác bị ép về `500` + một `errorId` (UUID) và **chỉ** ở môi trường dev mới kèm
`stack`/`detail`. Lỗi unexpected được log kèm `errorId` để đối chiếu. Action/JSON nhận lỗi dạng JSON,
còn page nhận trang HTML lỗi (mọi giá trị đã được escape an toàn).

## Ví dụ

Cell `hello` ném domain error có chủ đích, và để một `Error` thường rơi xuống tầng unexpected:

```ts
// app/cells/hello/index.tsx
async loader({ input, backend }) {
  if (input.name === "boom") throw new FluxeError("forbidden", "Không cho phép tên này", 403);
  if (input.name === "crash") throw new Error("nổ tung nội bộ");   // → 500 + errorId
  return { name: input.name, backendName: backend.name };
},
```

Cả hai tầng hành xử đúng kỳ vọng: `/hello/boom?json=1` → `403` + `code: "forbidden"` (domain);
`/hello/crash?json=1` → `500` + `code: "internal"` kèm `errorId` (unexpected). Và quan trọng: một lỗi
**không** làm sập server — request sau (`/hello/ok`) vẫn trả `200`.

## API

```ts
// @nmvuong92/fluxe
class FluxeError extends Error {
  constructor(code: string, message: string, status = 400, details?: unknown)
}
```

## Lưu ý

- Ở **production** (`NODE_ENV=production`) `detail`/stack **không** xuất ra client — chỉ `errorId`.
  Muốn xem nguyên nhân thật, tra log server theo `errorId`.
- Trang HTML lỗi do engine render escape mọi giá trị → không XSS qua message/detail.
- Action (`/__action/*`) luôn nhận lỗi dạng JSON; client parse thành `RpcError { code, status, details }`
  — xem [React & client](/reference/data-fetching/).
- `FluxeError` mặc định `status = 400`; truyền status khác (401/403/404/429/500) khi cần.
