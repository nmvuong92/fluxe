---
title: RBAC
description: Guard requireAuth/requireRole trên cell.
sidebar:
  order: 23
---

## Định nghĩa

**RBAC (Role-Based Access Control)** trong fluxe là **khai báo trên cell**, không rải `if` khắp
handler. Mỗi cell khai báo `requireAuth` (cần đăng nhập) hoặc `requireRole` (cần một role cụ thể);
biên request tự chặn **trước khi** chạy loader. Thiếu session → `401`; có session nhưng sai role →
`403`. `requireRole` ngầm yêu cầu auth (không có session thì cũng 401).

Role nằm trong `session.roles` — đã được ký HMAC (xem [Session](/reference/session/)) nên client
không sửa được role của mình.

## Cơ chế trong fluxe

`hasRole` chỉ là kiểm tra mảng `roles` an toàn null:

```ts
// @nmvuong92/fluxe
export function hasRole(session: Session | null, role: string): boolean {
  return !!session?.roles?.includes(role);
}
```

Cell khai báo guard qua hai field trong `CellDef`:

```ts
// @nmvuong92/fluxe — CellDef
requireAuth?: boolean;          // guard: cần session hợp lệ mới vào
requireRole?: string;           // guard RBAC: cần role này (ngầm cần auth)
```

Engine tự áp guard theo thứ tự — auth trước, role sau — **trước** khi gọi `cell.loader`:
thiếu session → ném `FluxeError("unauthorized", …, 401)`; có session nhưng sai role → ném
`FluxeError("forbidden", …, 403)`. Loader chỉ chạy khi đã qua cả hai cửa.

## Ví dụ

Cell `admin` chỉ cho role `admin`; loader đọc `session` đã verify mà không cần tự kiểm quyền:

```ts
// app/cells/admin/index.tsx
export default defineCell<{}, AdminData>({
  id: "admin",
  route: "/admin",
  hydration: "static",
  requireAuth: true,
  requireRole: "admin",          // RBAC: chỉ role admin
  async loader({ session }) {
    return { user: session?.user ?? "?", roles: (session?.roles as string[]) ?? [] };
  },
  view: Admin,
});
```

Với cell trên: user role `user` truy cập `/admin` → 403, user role `admin` → 200.

## API

```ts
// @nmvuong92/fluxe
hasRole(session: Session | null, role: string): boolean

// @nmvuong92/fluxe — CellDef
requireAuth?: boolean
requireRole?: string
```

## Lưu ý

- Phân biệt **401 vs 403**: chưa đăng nhập → 401 (đi `/login`); đã đăng nhập nhưng thiếu quyền → 403.
- `requireRole` **bao hàm** auth: không cần đặt thêm `requireAuth: true` khi đã có `requireRole`.
- Guard chỉ trên **page (loader)**. Action (`/__action/*`) tự kiểm quyền trong handler qua
  `ctx.session` nếu cần — runtime không áp `requireRole` cho action.
- Role được ký trong session HMAC → an toàn trước giả mạo; muốn đổi role phải đăng nhập lại (token mới).
