---
title: Validation
description: validateInput/withInput (Zod) — validate body request trước khi vào handler.
sidebar:
  order: 10
---

## Định nghĩa

**Body request không tin được.** Mọi dữ liệu client gửi lên (`POST /__action/*`) đều phải được
kiểm tra cấu trúc + kiểu trước khi chạm vào handler/backend. fluxe dùng **Zod** làm schema và biến
mọi lỗi thành **giá trị có kiểu** (`FluxeError` code `validation`, status `400`) kèm `details`
từng field — client render được lỗi cạnh đúng ô input.

Có hai mức dùng: `validateInput` (validate trực tiếp một giá trị) và `withInput` (bọc một action
để runtime **tự** validate input trước khi gọi handler — cách dùng phổ biến nhất trong cell).

## Cơ chế

`validateInput` parse một giá trị qua Zod; nếu sai, nó gom các `issues` thành `details` field-level
(`{ path, message }`) rồi ném `FluxeError("validation", …, 400, details)`.

`withInput` **không** validate ngay — nó chỉ **gắn schema** vào action. Khi có request action tới,
engine tự đọc schema đã gắn và validate input **sau** rate-limit + CSRF, **trước** khi gọi handler;
input sai → `FluxeError 400` (được biên request bắt và trả về client). Nhờ vậy handler luôn nhận input
đã đúng kiểu, không phải tự kiểm.

## Ví dụ

Action `add`/`toggle` của cell `todos` bọc bằng `withInput` — chỉ khai báo schema, không tự kiểm:

```ts
// app/cells/todos/index.tsx
actions: {
  list: async ({ backend }) => backend.listTodos(),
  add: withInput(
    z.object({ title: z.string().min(1, "Tiêu đề không được rỗng").max(200) }),
    async ({ input, backend }) => backend.addTodo(input.title),
  ),
  toggle: withInput(
    z.object({ id: z.string().min(1) }),
    async ({ input, backend }) => backend.toggleTodo(input.id),
  ),
},
```

Input sai trả lỗi có `details` từng field:

```json
{ "error": { "code": "validation", "message": "Dữ liệu không hợp lệ", "status": 400,
  "details": [{ "path": "title", "message": "Tiêu đề không được rỗng" }] } }
```

Gọi action `add` với `title` rỗng (qua CSRF hợp lệ) trả về `400` với `code: "validation"` và mảng
`details` — đúng như payload ở trên.

## API

```ts
// @nmvuong92/fluxe
validateInput<T>(schema: ZodType<T>, raw: unknown): T   // sai → FluxeError 400 field-level
withInput<I, O>(schema: ZodType<I>, handler: Action<I, O>): Action<I, O>   // bọc action: tự validate input
```

## Lưu ý

- Lỗi trả về là **giá trị có kiểu** — xem [Typed errors](/reference/errors/).
- `details` là mảng `{ path, message }`; `path` rỗng (root-level) hiển thị `"(root)"`.
- `withInput` chỉ **đính** schema — validate xảy ra ở runtime nên action không tự gọi `validateInput`.
- Validate chạy **sau** rate-limit + CSRF: request thiếu token bị chặn 403/429 trước khi tới schema.
