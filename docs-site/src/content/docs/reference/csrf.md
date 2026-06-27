---
title: CSRF
description: Chống Cross-Site Request Forgery bằng double-submit cookie — tự động cho mọi action.
sidebar:
  order: 22
---

## Định nghĩa

**CSRF (Cross-Site Request Forgery)** là kiểu tấn công: một site độc hại lừa trình duyệt của bạn
gửi request *kèm cookie đăng nhập* tới app fluxe (vì cookie tự đính theo mọi request cùng domain).
Nếu server chỉ tin cookie session, kẻ tấn công có thể thực hiện hành động thay người dùng.

**Phòng thủ — double-submit cookie:** ngoài cookie `session` (HttpOnly), server phát thêm một
cookie `csrf` **đọc được bằng JS**. Client phải **lặp lại** giá trị đó trong header `x-csrf-token`.
Site độc hại không đọc được cookie cross-origin → không gửi đúng header → bị chặn `403`.

## Cơ chế (tự động)

Engine lo trọn vòng double-submit, bạn không phải cấu hình gì:

1. **Phát cookie `csrf`** — ở request page đầu tiên, nếu chưa có cookie `csrf`, engine sinh token mới
   (`newCsrfToken()`) và set cookie `csrf=...; Path=/; SameSite=Lax` (cố ý **không** HttpOnly để JS đọc được).
2. **Client tự gửi lại** — khi bạn gọi action qua `useMutation`/`rpc`, client tự đọc cookie `csrf` và
   đính vào header `x-csrf-token`. Bạn không phải làm gì.
3. **Server kiểm** — ở mọi `POST /__action/*`, engine từ chối `403` (`FluxeError("csrf", …, 403)`) nếu
   thiếu cookie `csrf` hoặc header `x-csrf-token` không khớp giá trị cookie.

→ Dùng `useMutation`/`rpc` thì **CSRF hoàn toàn tự động**. Không cấu hình gì.

## Ví dụ: gọi action thủ công (ngoài `rpc`)

Nếu tự `fetch` một action, phải tự đính token (đọc từ cookie `csrf`):

```ts
const csrf = document.cookie.match(/(?:^|; )csrf=([^;]*)/)?.[1] ?? "";
await fetch("/__action/todos/add", {
  method: "POST",
  headers: { "content-type": "application/json", "x-csrf-token": csrf },
  body: JSON.stringify({ title: "mua sữa" }),
});
// thiếu header → 403 { error: { code: "csrf" } }
```

`curl` (vd test): lấy cookie từ một page trước rồi gửi kèm cả cookie lẫn header:

```bash
CSRF=$(curl -si localhost:5180/ | sed -nE 's/.*set-cookie: csrf=([^;]*).*/\1/p' | tr -d '\r')
curl -X POST localhost:5180/__action/todos/add \
  -H "x-csrf-token: $CSRF" -b "csrf=$CSRF" \
  -H 'content-type: application/json' -d '{"title":"x"}'
```

## API

```ts
// @nmvuong92/fluxe
newCsrfToken(): string                         // 24 byte ngẫu nhiên (hex)
parseCookie(header: string | undefined): Record<string, string>
```

## Lưu ý

- Cookie `csrf` **không** `HttpOnly` (client phải đọc được) — đúng thiết kế double-submit. Cookie
  `session` thì `HttpOnly`.
- `SameSite=Lax` thêm một lớp phòng thủ (chặn cross-site POST mặc định).
- Action sai/thiếu token → `FluxeError("csrf", …, 403)` — lỗi có kiểu, xem [Errors](/reference/errors/).
