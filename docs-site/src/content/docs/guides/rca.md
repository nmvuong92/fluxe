---
title: RCA — Resolved Cell Architecture
description: Triết lý lõi của fluxe — tách hợp đồng khỏi quyết định vận hành.
---

RCA tách rạch ròi **cái gì** (logic) khỏi **chạy thế nào** (vận hành).

## Cell — chỉ là hợp đồng

Một `Cell` khai báo `loader` (lấy data) + `view` (render). Nó **không** biết mình render
static hay island, cũng không biết `backend` bên dưới là memory/sqlite/postgres — chỉ thấy
**interface** bạn định nghĩa ở `app/backend.ts` (data được **tiêm vào** qua DI).

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
| **Data** (không resolve — **DI**) | backend bạn implement | bạn inject qua `makeServer(…, { backend })` từ `app/backend.ts` |

Engine **không ship driver data** và không biết gì về DB của bạn — nó chỉ *resolve render*. Backend
là **interface user-owned** ở `app/backend.ts`, tiêm vào runtime; profile/manifest không đụng tới.

## Vì sao quan trọng

- **Đổi nơi lưu không đụng logic** — chuyển `todos` từ memory sang sqlite = sửa 1 dòng `app/backend.ts`.
- **Test cực dễ** — mock `Backend` là xong, cell không ràng buộc hạ tầng.
- **Tối ưu đúng tầng** — cell static được resolve sang render-cache mà code cell giữ nguyên.

→ Xem thực hành ở [Backends](/reference/data/).
