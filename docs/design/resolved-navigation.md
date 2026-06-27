# Thiết kế: Runtime/Transport 2-option + Resolved Navigation

> Mục tiêu: (1) default = tối ưu nhất — backend↔React **0 HTTP roundtrip** (cùng process);
> (2) option scale backend ra nhiều server sau này; (3) điều hướng tối ưu hơn Inertia.
> Trạng thái: thiết kế đã chốt hướng (chat), file này để implement bám theo.

## 1. Phân tích trung thực: "0 roundtrip" nghĩa là gì

Có **hai** loại roundtrip, lẫn lộn là tự lừa:

- **(A) backend ↔ React-SSR (trong server):** loader gọi `backend.x()` rồi React render.
  Nếu **cùng process** → đây là **lời gọi hàm, KHÔNG HTTP** → **0 roundtrip. Làm được, là default.**
- **(B) browser ↔ server (mutation / nav lấy data mới):** là **vật lý** — không framework nào
  bỏ được (Inertia cũng không). Chỉ *giảm*: nhúng data lúc cold-load, static cell 0-data,
  prefetch, optimistic update.

→ Cam kết: tối ưu (A) triệt để + giảm (B) tối đa. **Không hứa (B) = 0** (đó là nói dối).

## 2. So với Inertia (vì sao fluxe hơn được)

Inertia khi bật SSR phải chạy **process Node riêng** chỉ để pre-render React → PHP (logic)
**→ hop →** Node (render). fluxe **một runtime**: Node vừa chạy loader/backend vừa render React.

| | Inertia + SSR | fluxe (default) |
|---|---|---|
| backend logic ↔ React render | PHP → **hop** → Node | cùng process, **function call (0 hop)** |
| cold load data | nhúng JSON vào HTML | nhúng `window.__FLUXE__` — ngang |
| nav → trang khác | **luôn** 1 XHR | **static → 0 fetch** (cache); island → 1 XHR (prefetch được) |
| static page client runtime | luôn ship SPA runtime | **0 JS** trên cell static |
| mutation | 1 XHR (vật lý) | 1 XHR — ngang |

→ fluxe hơn ở: **bỏ hop PHP↔Node**, **static cell 0 JS + 0 nav-fetch**, **prefetch island**.
Không hơn ở mutation (ai cũng phải roundtrip).

## 3. Hai option (đã là trục RCA — phần lớn ĐÃ có)

### Option 1 — default, tối ưu nhất (đã có)
Backend `memory`/`sqlite` **in-process** cùng Node với React. `loader → backend.x()` = function
call. Data nhúng SSR → client hydrate 0 fetch thêm. **Không cần làm gì — đây là mặc định.**

### Option 2 — scale backend nhiều server (đã có cơ chế)
Resolve backend *một số cell* → service remote (HTTP/gRPC/UDS) qua `profiles.ts` `cellBackends`
+ `endpoints`. Chịu roundtrip **chỉ cho cell đó**, đổi lại scale ngang. Đã test live-swap.
→ Không cần code mới; chỉ cần **doc hoá** rõ "profile distributed".

## 4. Resolved Navigation (PHẦN CẦN IMPLEMENT)

Engine biết mỗi cell `render.mode` (static|island) → chọn cách điều hướng tối ưu **theo cell**:

```
click <Link href>
  ├─ target = STATIC  → để browser điều hướng thường (page static + cache/304, ~instant, 0 JS)
  └─ target = ISLAND  → SPA swap: fetchPageProps(url) → swap component + history.pushState
                         (prefetch on hover → data có sẵn trước khi bấm → cảm giác 0 roundtrip)
```

**Ràng buộc thật (tôn trọng static-first):**
- SPA swap chỉ giữa **island cells** — vì cell static **không ship JS** (không có runtime để
  intercept), và component static **không nằm trong client bundle**. Island→static = full nav
  (vốn đã nhanh nhờ cache). Đây là feature, không phải hạn chế: tải nhẹ hơn Inertia.
- Mutation vẫn `rpc()` POST (roundtrip) — optimistic update che latency (đã có `mutate()`).

### Thành phần
1. **`src/core/nav.ts`** (thuần, testable): cache prefetch `Map<url, props>`; `decideNav(url,
   registry)` → `{kind:"spa"|"hard", cell?, data?}`; quản lý in-flight dedup.
2. **`src/react/Link.tsx`**: render `<a href>`; `onMouseEnter` → prefetch; `onClick` (chuột trái,
   không modifier) → `navigate()`; fallback `<a>` thường nếu JS tắt (progressive enhancement).
3. **Wire `src/client.tsx`**: sau hydrate, giữ **root state** (cell+data); `navigate()` đổi state
   → re-render; `popstate` cho back/forward.
4. **Server**: đã trả `{cell, data}` cho `x-fluxe:1` — không đổi.

### Đo để chứng minh hơn Inertia
- nav island có prefetch: thời gian từ click → render (kỳ vọng ~0ms vì data đã có).
- nav static: 0 request data (chỉ HTML cache/304).
- payload nav island = chỉ props JSON (không asset) — như Inertia, nhưng + prefetch.

## 5. Kế hoạch implement (TDD, test:all xanh từng bước)

1. `src/core/nav.ts` + `nav.test.ts`: prefetch cache (set/get/dedup), `decideNav` (static→hard,
   island→spa, external→hard). **Thuần, unit test.**
2. `src/react/Link.tsx`: component; test render `<a href>` + gọi prefetch/navigate (mock).
3. Wire `client.tsx`: root re-render state + popstate. (Integration — verify qua selftest/manual.)
4. Demo: thêm `<Link>` vào layout/cells; đo nav static vs island.

## 6. Phi mục tiêu (không làm, để không over-engineer)
- KHÔNG bỏ roundtrip mutation (vật lý).
- KHÔNG SPA-route cell static (cố ý — giữ 0 JS).
- KHÔNG client-side router đầy đủ (nested route, guards…) — chỉ swap cell theo URL.
