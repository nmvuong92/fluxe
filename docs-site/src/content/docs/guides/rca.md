---
title: RCA — Resolved Cell Architecture
description: Triết lý lõi của fluxe — tách hợp đồng khỏi quyết định vận hành.
---

> **Write the contract. Resolve the substrate.** — Viết hợp đồng, để engine chiếu xuống nền tảng.

RCA tách rạch ròi **cái gì** (logic) khỏi **chạy thế nào** (vận hành). Đó là luật bất biến
của fluxe:

> **Logic chỉ phụ thuộc HỢP ĐỒNG (contract), không bao giờ phụ thuộc NỀN TẢNG (substrate).**
> Quyết định vận hành là thứ được *giải (resolved)*, không phải bạn viết tay.

Hệ quả: **tối ưu theo kiến tạo** — vì render là *output của resolver*, cell `static` ship
0 JS và bỏ transport khi in-process **mà không cần bạn viết lại**. Tối ưu là việc của engine,
không phải kỷ luật của bạn.

Hai mặt phẳng bạn cần nhớ:

- **Contract Plane** — nơi bạn sống: cell + loader + view + contract, type-safe, thuần logic.
  Đây là *toàn bộ* thứ bạn viết.
- **Resolution Plane** — nơi engine sống: chiếu mỗi hợp đồng xuống nền tảng cụ thể theo
  profile + phân tích build. Bạn không chạm.

## Cell — chỉ là hợp đồng

Một `Cell` khai báo `loader` (lấy data) + `view` (render). Nó **không** biết mình render
static hay island, cũng không biết `backend` bên dưới là memory/sqlite/postgres — chỉ thấy
**interface** bạn định nghĩa ở `app/backend/data.ts` (data được **tiêm vào** qua DI).

```ts
// app/cells/home/index.ts — cell KHÔNG chứa quyết định vận hành
export default defineCell<{}, HomeData>({
  id: "home",
  route: "/",
  hydration: "static",          // gợi ý, không phải mệnh lệnh — Resolution Plane mới quyết
  async loader({ backend }) {
    return { title: "fluxe", backendName: backend.name };
  },
  view: ({ data }) => <h1>{data.title}</h1>,
});
```

## Resolution Plane — nơi mọi quyết định được "giải"

Lúc build, engine giải từng cell **độc lập** theo profile, ghi ra `.fluxe/resolution.json`:

```json
{
  "profile": "mixed",
  "cells": {
    "home":  { "render": { "mode": "static", "shipClientJs": false } },
    "todos": { "render": { "mode": "island" } }
  }
}
```

Runtime đọc manifest này để định tuyến. **Cùng một cell + cùng một `makeServer`,
đổi manifest → hành vi khác.** Đó là toàn bộ phép màu. Lưu ý: manifest **chỉ giải trục render**
— không có field backend. Data đến từ DI (xem dưới).

## Render được giải, data là DI

| Khía cạnh | Giá trị | Ai quyết |
|------|---------|----------|
| **Render** (được *resolve*) | static · island | `hydration` (gợi ý) + manifest override theo profile |
| **Data** (không resolve — **DI**) | backend bạn implement | bạn inject qua `makeServer(…, { backend })` từ `app/backend/data.ts` |

Engine **không ship driver data** và không biết gì về DB của bạn — nó chỉ *resolve render*. Backend
là **interface user-owned** ở `app/backend/data.ts`, tiêm vào runtime; profile/manifest không đụng tới.

## Vì sao quan trọng

- **Đổi nơi lưu không đụng logic** — chuyển `todos` từ memory sang sqlite = sửa 1 dòng `app/backend/data.ts`.
- **Test cực dễ** — mock `Backend` là xong, cell không ràng buộc hạ tầng.
- **Tối ưu đúng tầng** — cell static được resolve sang render-cache mà code cell giữ nguyên.

## fluxe = CẦU NỐI, không reinvent

RCA chiếu hợp đồng xuống nền tảng — nó **không** viết lại thứ hạ tầng đã làm tốt. Ranh giới:

| GIỮ trong core (fluxe làm) | THUỘC HOST + ecosystem (bạn mount trước fluxe) |
|---------------------------|-----------------------------------------------|
| cells/SSR · resolver · contract + `/__rpc` + validate | auth/session/RBAC → `better-auth`, `lucia`, `passport` |
| realtime (broker/SSE) · observability (`/_fluxe`) | rate-limit → `express-rate-limit` |
| seo · i18n · render-cache | jobs/queue → `bullmq` · upload → `multer` |

fluxe chạy như **catch-all** cạnh framework host (Express/Fastify): mount middleware của host
**trước**, fluxe lo phần render + data-contract. Auth chỉ là **lớp tích hợp** (`@nmvuong92/fluxe/auth`):
`bridgeSession` gắn `req.session`, `useSession()` đọc typed — provider mới lo OAuth/password/cookie.

## Một runtime TypeScript — quyết định đã đo

fluxe là **một runtime TS duy nhất** trên `node:http`. Không polyglot, không sidecar Go/Rust.
Đây là kết luận **đo được**, không phải sở thích: V8 JIT ngang Rust `-O3` ở vòng lặp scalar đơn
luồng; native chỉ thắng rõ khi đa luồng — mà hot-path của fluxe là **React SSR + I/O đơn luồng**.
Backend = driver data TS in-process (`memory · sqlite · postgres`), đổi bằng config.

→ Xem thực hành ở [Backends](/reference/data/).
