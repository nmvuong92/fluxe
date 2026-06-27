---
title: Observability
description: Endpoint /_fluxe, stats, requests; request log ring buffer; ETag/304.
sidebar:
  order: 60
---

## Định nghĩa

**Observability** là khả năng *nhìn thấy* app đang làm gì: mỗi cell giải về backend nào, request
gần đây mất bao lâu, RAM/CPU hiện tại. Bối cảnh fluxe: mọi thứ nằm chung **một port** (mặc định
`5180`) — không có port riêng cho dashboard — và truy cập qua tiền tố `/_fluxe`.

Trang này gồm ba mảnh: **request log** (ring buffer ghi O(1)), **ETag/304** (render cache cho
props JSON), và các **endpoint quan sát** `/_fluxe*`.

## Cơ chế trong fluxe

**1. Request log — Ring Buffer** ghi đè vị trí cũ nhất, O(1)/record (không `Array.shift` O(n)):

```ts
// @nmvuong92/fluxe
export function createRecorder(max = 200): Recorder {
  const buf = new Array<ReqLog | undefined>(max);
  let writeIdx = 0; // vị trí ghi tiếp theo
  let size = 0;

  return {
    record(e) {
      buf[writeIdx] = e;
      writeIdx = (writeIdx + 1) % max;
      if (size < max) size++;
    },
    recent(n = 50) {
      const count = Math.min(n, size);
      const out: ReqLog[] = [];
      for (let i = 0; i < count; i++) {
        out.push(buf[(writeIdx - 1 - i + max * 2) % max]!); // lùi từ mới nhất
      }
      return out; // newest-first
    },
  };
}
```

Engine tự ghi mỗi request vào recorder khi response `finish` (method/path/status/ms/ts).

**2. ETag / 304** — hash body, client gửi lại `If-None-Match` → `304` (0 byte body) nếu không đổi:

```ts
// @nmvuong92/fluxe
export function etagOf(body: string): string {
  return `"${createHash("sha1").update(body).digest("base64url").slice(0, 27)}"`;
}

export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").map((s) => s.trim()).includes(etag);
}
```

Engine áp cho props JSON (SPA nav refetch nhiều): hash body bằng `etagOf`, nếu
`etagMatches(if-none-match, etag)` thì trả `304` không kèm body, ngược lại trả `200` + body kèm
header `etag`.

**3. Panel RCA** — `renderResolutionPanel` dựng HTML: mỗi cell giải trục nào + request gần nhất:

```ts
// @nmvuong92/fluxe
export function renderResolutionPanel(m: ResolutionManifest, requests: ReqLog[] = []): string {
  const rows = Object.values(m.cells).map((c) => `
      <tr>
        <td><code>${c.id}</code></td>
        <td><code>${c.route}</code></td>
        <td>${c.render.mode}</td>
        <td>${c.render.shipClientJs ? "✓ JS" : "0 JS"}</td>
        <td><span class="badge ${c.backend.language}">${c.backend.language}</span></td>
        <td>${c.backend.transport}</td>
        <td>${c.backend.endpoint ?? "—"}</td>
      </tr>`).join("");
  // … dựng <table> + bảng "Recent requests" từ `requests`
}
```

**4. Endpoint quan sát** — engine expose sẵn ba endpoint trên cùng port của app: `/_fluxe/stats`
(JSON RAM/CPU/uptime), `/_fluxe/requests` (JSON request log gần nhất), và `/_fluxe` (HTML panel
RCA + request gần đây). Chi tiết ở bảng dưới.

## Endpoint quan sát

| Mục đích | URL | Trả về |
|----------|-----|--------|
| Portal RCA | `/_fluxe` | HTML: bảng resolution mỗi cell + 20 request gần nhất |
| Profiling RAM/CPU | `/_fluxe/stats` | JSON: `rss`, `heapUsed`, `cpuUser`, `cpuSystem`, `uptimeMs` |
| Request log | `/_fluxe/requests` | JSON: request gần nhất (method/path/status/ms/ts) |
| Client bundle | `/client.js` | bundle island (cache buffer lúc boot) |

## Ví dụ

```bash
# RAM/CPU/uptime hiện tại
curl -s localhost:5180/_fluxe/stats

# Request log gần đây (newest-first)
curl -s localhost:5180/_fluxe/requests

# Mở dashboard RCA trên trình duyệt
open http://localhost:5180/_fluxe
```

Tận dụng 304 — refetch props mà không tải lại body nếu data không đổi:

```bash
ET=$(curl -si 'localhost:5180/todos?json=1' -H 'x-fluxe: 1' | sed -nE 's/.*etag: (".*").*/\1/p' | tr -d '\r')
curl -si 'localhost:5180/todos?json=1' -H 'x-fluxe: 1' -H "if-none-match: $ET" | head -1   # → HTTP/1.1 304
```

## API

```ts
// @nmvuong92/fluxe
createRecorder(max = 200): Recorder
interface Recorder {
  record(e: ReqLog): void;
  recent(n?: number): ReqLog[];   // newest-first, mặc định 50
}

// @nmvuong92/fluxe
etagOf(body: string): string
etagMatches(ifNoneMatch: string | undefined, etag: string): boolean

// @nmvuong92/fluxe
renderResolutionPanel(m: ResolutionManifest, requests?: ReqLog[]): string
```

## Lưu ý

- Ring buffer ghi O(1)/record, **nhanh hơn ~4.3× so với `push`+`shift`** — log không tạo áp lực
  GC dưới tải. Bound cứng `max` (mặc định 200) nên không rò RAM; quá `max` → đè record cũ nhất.
- `recent(n)` trả **newest-first** (mới nhất trước); `/_fluxe` hiển thị 20 dòng, `/_fluxe/requests`
  trả mặc định 50.
- ETag chỉ áp cho **props JSON** (`?json=1` / `x-fluxe: 1`). Cell static cache ở tầng render —
  xem [Render cache](/guides/static-cache/).
- Các endpoint `/_fluxe*` hiện **chưa gate auth** — production cần đặt sau auth (vd reverse proxy
  hoặc middleware) để không lộ thông tin quan sát ra ngoài.
