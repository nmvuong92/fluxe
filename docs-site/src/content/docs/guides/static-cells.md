---
title: "Cell static — tối ưu 0 JS (nâng cao)"
description: Opt-in hydration "static" để ship 0 JS cho trang nặng-nội-dung. Không cần ở luồng chính.
sidebar:
  order: 10
  badge: Nâng cao
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Mặc định mọi cell là **island** (interactive, hydrate React) — bạn **không khai báo `hydration`**.
Trang này nói về **opt-in** `hydration: "static"`: một tối ưu cho trang nặng-nội-dung không cần
JS. Bỏ qua được nếu chưa cần.
</Aside>

## Khi nào dùng static

Trang **không có tương tác client** (landing, blog, docs, điều khoản…) → khai báo `static` để
**ship 0 JS**: render server, gửi HTML thuần, không bundle, không hydrate. Nhanh hơn + nhẹ hơn.

```bash
fx new terms --static     # sinh cell static
```

```tsx
// app/cells/terms/index.tsx
export default defineCell<{}, TermsData>({
  id: "terms",
  route: "/terms",
  hydration: "static",        // ← opt-in: 0 JS
  layout: "site",
  async loader() { return { title: "Điều khoản" }; },
  view: Terms,
});
```

*View Source*: trang static kết thúc bằng `<!-- static: 0 JS -->` — không có `<script>` client.

## Đánh đổi

| | island (mặc định) | static (opt-in) |
|---|---|---|
| JS xuống client | có (hydrate) | **0** |
| Tương tác (useState, useQuery…) | ✓ | ✗ (không hydrate) |
| SPA nav khi rời trang | ✓ | full nav (vẫn nhanh nhờ cache) |
| Tốc độ tải | tốt | **tốt nhất** |

Tương tác chung (theme toggle, nav active) vẫn chạy trên trang static nhờ **vanilla `shellScript`**
trong layout (không cần React) — xem [Layout & Theme](/reference/layout/).

## Render cache (đi kèm static)

Cell static được engine **memoize** (render 1 lần → giữ Buffer → ghi lại), gate bằng `etag(data)`.
Cell stream (Suspense) đặt `cache: false`. Chi tiết + số đo: [Render cache](/guides/static-cache/).

## Nguyên tắc

> Bắt đầu mọi trang là **island** (đơn giản, interactive ngay). Khi đo thấy một trang không cần
> JS, đổi `hydration: "static"` — một dòng, 0 rủi ro. Đừng tối ưu sớm.
