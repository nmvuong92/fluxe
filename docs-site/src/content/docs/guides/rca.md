---
title: RCA — Resolved Cell Architecture
description: Triết lý lõi của fluxe — tách hợp đồng khỏi quyết định vận hành.
---

RCA tách rạch ròi **cái gì** (logic) khỏi **chạy thế nào** (vận hành).

## Cell — chỉ là hợp đồng

Một `Cell` khai báo `loader` (lấy data) + `view` (render). Nó **không** biết mình chạy
ngôn ngữ nào, render static hay island, data đến từ backend nào.

```ts
// app/cells/home/index.ts — cell KHÔNG chứa quyết định vận hành
export default defineCell<{}, HomeData>({
  id: "home",
  route: "/",
  hydration: "static",          // gợi ý, không phải mệnh lệnh — Resolution Plane mới quyết
  async loader({ backend }) {
    return { title: "fluxe", backendName: backend.name };
  },
  view: ({ data }) => h("h1", null, data.title),
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
               "backend": { "language": "go", "transport": "http" } }
  }
}
```

Runtime đọc manifest này để định tuyến. **Cùng một cell + cùng một `makeServer`,
đổi manifest → hành vi khác.** Đó là toàn bộ phép màu.

## 5 trục được giải

| Trục | Giá trị | Ai quyết |
|------|---------|----------|
| Language | TS · Go · Rust | profile / per-cell |
| Render | static · island | `hydration` + manifest override |
| Transport | in-process · http · sse | resolver |
| Backend | memory · go · rust | profile `backend` / `cellBackends` |
| Scale | 1-node · cluster · edge | profile (tương lai) |

## Vì sao quan trọng

- **Đổi hạ tầng không đụng logic** — chuyển `todos` từ memory sang Rust = sửa 1 dòng config.
- **Test cực dễ** — mock `Backend` là xong, cell không ràng buộc hạ tầng.
- **Tối ưu đúng tầng** — cell static được resolve sang render-cache/Go host mà code cell giữ nguyên.

→ Xem thực hành ở [Switch backend](/guides/switch-backend/).
