---
title: Cell tĩnh & render cache
description: Vì sao cell static nhanh ~3× và tốn RAM ít hơn — zero-copy kiểu Node.
---

Cell `render.mode === "static"` cho ra HTML **giống hệt nhau giữa các request**. Render lại
React mỗi lần là phí. fluxe memoize phần render đắt, giữ `Buffer`, ghi lại trên mỗi request.

## Cơ chế

```text
GET /  ──► loader(data) (rẻ) ──► etag(data)
          ├─ etag khớp cache → res.end(buffer đã render)   ◄── 99.99% request
          └─ etag lệch → render React 1 lần → lưu {etag, buffer}
```

- Gate bằng `etag(data)`: data đổi ⇒ miss ⇒ render lại → **không bao giờ trả HTML cũ**.
- Cache **bound bằng LRU** (`maxKeys`) để route động `/hello/[name]` không rò RAM.
- `client.js` đọc đĩa **một lần** lúc boot, tái dùng cùng buffer (zero-copy kiểu Node).

## Số đo (64 conc, 5s/path)

| Route | RPS trước → sau | p99 | RAM |
|-------|-----------------|-----|-----|
| `/` (static) | 10,643 → **31,433** (×2.95) | 11.3 → 5.1ms | 240 → **159 MB** |
| `/hello/world` | 11,648 → **31,042** (×2.66) | 10.3 → 4.9ms | 248 → **165 MB** |
| `/todos?json=1` (control) | 33,500 → 33,664 | không đổi | — |

Đường động không đổi → đúng như gate `render.mode === "static"`. Output byte-identical
(125/125 test xanh, md5 hai lần GET giống hệt).

:::note[Tự động]
Render cache do engine lo — bạn không cấu hình gì. Cell `static` được memoize (Hash Table + LRU
bound), gate bằng `etag(data)` nên không bao giờ trả HTML cũ.
:::
