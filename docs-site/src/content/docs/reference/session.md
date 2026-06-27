---
title: Session
description: Session HMAC stateless — signSession/verifySession/hasRole.
sidebar:
  order: 20
---

## Định nghĩa

**Session** trong fluxe là **stateless, ký HMAC**. Token đặt trong cookie `session` (HttpOnly) có
dạng `base64url(payload).base64url(HMAC-sha256(payload))`. Server **không** giữ session store — chỉ
cần `FLUXE_SECRET` để ký và verify lại. Đổi 1 byte trong payload hay chữ ký → verify fail → coi như
chưa đăng nhập.

Ưu điểm: không cần Redis/DB cho session, scale ngang dễ (mọi node cùng secret verify được). Đánh đổi:
không revoke tức thời một token đã phát (phải đổi secret hoặc thêm danh sách đen).

## Cơ chế

`signSession` mã hoá payload (`base64url(JSON)`), tính HMAC-sha256 bằng secret rồi nối thành
`body.sig`. `verifySession` tính lại chữ ký từ `body` và so **timing-safe** (`node:crypto`) — chống
timing attack; chỉ khi khớp mới parse payload trả về, sai/hỏng thì trả `null`.

`Session` là kiểu mở — bắt buộc `user`, tuỳ chọn `roles`, và cho thêm field tuỳ ý:

```ts
// @nmvuong92/fluxe
export interface Session {
  user: string;
  roles?: string[];
  [k: string]: unknown;
}
```

Bạn không phải tự verify trong cell: mỗi request, engine verify cookie `session` một lần rồi tiêm
session vào loader/action qua `ctx.session`. Khi `POST /login` thành công, engine ký session và set
cookie `session` (HttpOnly) kèm cookie `csrf`.

## Ví dụ

Vòng đời session đầy đủ: `POST /login` đúng mật khẩu → `200` kèm cookie `session`; gửi cookie đó vào
trang bảo vệ (`/secret`) → `200` và thấy tên user; còn cookie giả mạo (`session=tampered.invalid`) →
`401` vì verify chữ ký thất bại.

## API

```ts
// @nmvuong92/fluxe
signSession(payload: Session, secret: string): string
verifySession(token: string | undefined, secret: string): Session | null   // so chữ ký timing-safe
hasRole(session: Session | null, role: string): boolean                     // RBAC
```

## Lưu ý

:::caution[Tenet T1]
HTTPS-only kể cả local; secret session/CSRF **không** hardcode — nạp qua [`loadEnv`](/reference/env/).
:::

- Cookie `session` là **HttpOnly** (JS không đọc được) — chống đánh cắp token qua XSS. Cookie `csrf`
  thì cố ý không HttpOnly (xem [CSRF](/reference/csrf/)).
- Payload **không mã hoá**, chỉ **ký** — đừng để thông tin nhạy cảm trong session (ai cũng base64-decode được).
- Verify trả `null` ở mọi trường hợp hỏng (thiếu token, sai format, sai chữ ký, JSON lỗi) → đồng nhất coi như chưa đăng nhập.
