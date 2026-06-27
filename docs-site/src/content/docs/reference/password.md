---
title: Password
description: hashPassword/verifyPassword (scrypt, memory-hard).
sidebar:
  order: 21
---

## Định nghĩa

Mật khẩu **không bao giờ lưu dạng thô**. fluxe băm bằng **scrypt** — hàm dẫn xuất khoá
**memory-hard** (tốn RAM, chống brute-force bằng GPU/ASIC) có sẵn trong `node:crypto`, không cần
thư viện ngoài. Mỗi mật khẩu dùng một **salt ngẫu nhiên 16 byte**, nên hai user cùng mật khẩu vẫn ra
hash khác nhau (chống rainbow table). So sánh lúc đăng nhập là **timing-safe** để không lộ thông tin
qua thời gian phản hồi.

Định dạng lưu: `scrypt$<salt-hex>$<hash-hex>` — tự mô tả thuật toán + salt, dễ nâng cấp sau này.

## Cơ chế

`hashPassword` sinh salt ngẫu nhiên 16 byte mỗi lần, dẫn xuất 32 byte bằng `scryptSync` và trả về
chuỗi `scrypt$<salt-hex>$<hash-hex>`. `verifyPassword` tách `salt`/`hash` từ chuỗi lưu, băm lại input
với cùng salt rồi so **timing-safe** (`timingSafeEqual` trên Buffer cùng độ dài).

## Ví dụ

Băm mật khẩu khi tạo/đổi user (app thật lưu hash vào DB), và verify trước khi ký session lúc đăng nhập:

```ts
import { hashPassword, verifyPassword, FluxeError } from "@nmvuong92/fluxe";

// khi tạo user: lưu hash, không lưu mật khẩu thô
const stored = hashPassword("secret");   // "scrypt$<salt>$<hash>"

// khi đăng nhập:
if (!verifyPassword(inputPassword, stored)) {
  throw new FluxeError("unauthorized", "Sai tài khoản hoặc mật khẩu", 401);
}
```

`verifyPassword` trả `false` cho mật khẩu sai và `true` cho mật khẩu đúng — đó cũng là điều phân biệt
`/login` trả `401` hay `200`.

## API

```ts
// @nmvuong92/fluxe
hashPassword(password: string): string            // "scrypt$<salt>$<hash>"
verifyPassword(password: string, stored: string): boolean   // timing-safe
```

## Lưu ý

- Verify **không** dùng `===` trên chuỗi hash mà `timingSafeEqual` trên Buffer cùng độ dài — tránh
  rò bit qua thời gian so sánh.
- Stored sai định dạng (thiếu salt/hash, algo lạ) → `verifyPassword` trả `false`, không ném lỗi.
- `scryptSync` chặn event loop khi băm — chấp nhận được cho login (ít, không hot-path). Tải cao có
  thể chuyển `scrypt` async.
- Production có thể đổi **Argon2id** (`npm i argon2`); scrypt là chuẩn built-in, an toàn — nhờ định
  dạng `algo$...` việc nâng cấp không phá dữ liệu cũ.
