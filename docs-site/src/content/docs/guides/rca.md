---
title: RCA — Resolved Cell Architecture
description: Triết lý lõi của fluxe — tách hợp đồng khỏi quyết định vận hành.
---

RCA tách rạch ròi **cái gì** (logic) khỏi **chạy thế nào** (vận hành).

## Cell — chỉ là hợp đồng

Một `Cell` khai báo `loader` (lấy data) + `view` (render). Nó **không** biết mình render
static hay island, data đến từ driver nào (memory/sqlite/postgres).

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
    "todos": { "render": { "mode": "island" },
               "backend": "sqlite" }
  }
}
```

Runtime đọc manifest này để định tuyến. **Cùng một cell + cùng một `makeServer`,
đổi manifest → hành vi khác.** Đó là toàn bộ phép màu.

## 2 trục được giải

| Trục | Giá trị | Ai quyết |
|------|---------|----------|
| Render | static · island | `hydration` + manifest override |
| Data (backend) | memory · sqlite · postgres | profile `backend` / `cellBackends` |

## Vì sao quan trọng

- **Đổi hạ tầng không đụng logic** — chuyển `todos` từ memory sang sqlite = sửa 1 dòng config.
- **Test cực dễ** — mock `Backend` là xong, cell không ràng buộc hạ tầng.
- **Tối ưu đúng tầng** — cell static được resolve sang render-cache mà code cell giữ nguyên.

→ Xem thực hành ở [Backends](/reference/data/).
