---
title: Realtime
description: Pub/sub broker, presence, SSE subscribe.
sidebar:
  order: 30
---

## Định nghĩa

**Realtime** trong fluxe là khả năng đẩy event từ server xuống client *mà không cần client
hỏi lại* (poll). Bối cảnh: khi một user add/toggle một todo, các tab/người dùng khác đang xem
cùng trang nên thấy thay đổi ngay — không phải F5.

fluxe hiện thực bằng **SSE (Server-Sent Events) — luồng MỘT CHIỀU** server → client, **không phải
WebSocket**. Mỗi action sau khi chạy xong sẽ `publish` lên một topic (chính là `cellId`); client
nào đang `subscribe` topic đó qua `EventSource` sẽ nhận event và tự refetch. Lõi gồm hai phần
in-memory, dependency-free, bản 1-node: **broker** (pub/sub) và **presence** (ai đang online).

## Cơ chế trong fluxe

**1. Broker pub/sub** — `Map<topic, Set<subscriber>>`, lookup/fan-out O(1):

```ts
// @nmvuong92/fluxe
export function createBroker(): Broker {
  const subs = new Map<string, Set<Subscriber>>();
  return {
    subscribe(topic, fn) {
      let set = subs.get(topic);
      if (!set) { set = new Set(); subs.set(topic, set); }
      set.add(fn);
      return () => {
        set!.delete(fn);
        if (set!.size === 0) subs.delete(topic);
      };
    },
    publish(topic, data) {
      subs.get(topic)?.forEach((fn) => fn(data));
    },
    count(topic) {
      return subs.get(topic)?.size ?? 0;
    },
  };
}
```

**2. Presence** — đếm ai đang online per topic, refcount theo `id` để chịu multi-tab:

```ts
// @nmvuong92/fluxe — topic → (id → số kết nối)
join(topic, id) {
  let m = topics.get(topic);
  if (!m) { m = new Map(); topics.set(topic, m); }
  m.set(id, (m.get(id) ?? 0) + 1);
  return () => {                                  // hàm leave
    const mm = topics.get(topic);
    if (!mm) return;
    const n = (mm.get(id) ?? 0) - 1;
    if (n <= 0) mm.delete(id); else mm.set(id, n);
    if (mm.size === 0) topics.delete(topic);
  };
},
```

**3. Endpoint SSE** `GET /__sse/<topic>` — engine tự mở một stream `text/event-stream`, subscribe
topic qua broker và (nếu có `?id=`) ghi nhận presence; mỗi `publish` được đẩy xuống client, và khi
kết nối đóng thì tự unsubscribe + leave presence.

**4. Mỗi action tự publish lên topic = cellId** sau khi chạy xong, nên client khác đang subscribe
cell đó nhận được event và refetch — bạn không phải gọi `publish` thủ công.

**5. Client subscribe qua `EventSource`** — trả hàm hủy:

```ts
// @nmvuong92/fluxe/client
export function subscribe(topic: string, onData: (data: any) => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const es = new EventSource(`/__sse/${encodeURIComponent(topic)}`);
  es.onmessage = (e) => {
    try { onData(JSON.parse(e.data)); } catch { /* ignore */ }
  };
  return () => es.close();
}
```

## Ví dụ

Cell `todos` subscribe topic `"todos"`; khi có client khác add/toggle → refetch danh sách:

```tsx
// app/cells/todos/view.tsx
import { rpc, subscribe } from "@nmvuong92/fluxe/client";

const q = useQuery<Todo[]>("todos", () => rpc("todos", "list", {}), { initial: data.todos });

// Realtime: client khác đổi → revalidate.
useEffect(() => subscribe("todos", () => q.refetch()), []);
```

## Broker dùng chung với host (publish từ job/worker)

Mặc định fluxe tự tạo broker. Muốn **code host** (vd bullmq worker đóng phiên đúng giờ) đẩy
realtime tới client → tự tạo broker và **tiêm** vào fluxe để cùng một bus:

```ts
import { createBroker } from "@nmvuong92/fluxe";
export const broker = createBroker();                       // app/backend/broker.ts

// server.ts — chia sẻ broker cho fluxe + worker
app.use(fluxe(manifest, cells, layouts, { contract, resolvers, broker }));

// jobs.ts (bullmq worker) — publish cùng broker → SSE client nhận
broker.publish(`lot:${id}`, lot);   // vd: job đóng phiên → mọi người thấy "SOLD"
```

Resolver có thể `publish("lot:created", lot)` để worker (subscribe broker) lên lịch job — **decouple**
resolver khỏi queue. → fluxe lo realtime/SSE, **queue là việc host** (xem [Một runtime TS] / boundary).

## API

```ts
// @nmvuong92/fluxe
createBroker(): Broker
interface Broker {
  subscribe(topic: string, fn: Subscriber): () => void;   // trả unsub
  publish(topic: string, data: unknown): void;
  count(topic: string): number;
}

// @nmvuong92/fluxe
createPresence(): Presence
interface Presence {
  join(topic: string, id: string): () => void;   // trả leave
  members(topic: string): string[];
  count(topic: string): number;
}

// @nmvuong92/fluxe/client
subscribe(topic: string, onData: (data: any) => void): () => void
```

Endpoint runtime: `GET /__sse/<topic>` (kèm `?id=<userId>` để bật presence).

## Lưu ý

- Realtime hiện là **SSE một chiều** (server → client), **không phải WebSocket** — client không
  gửi ngược qua kênh này; muốn gửi lên thì gọi action (`rpc`) như bình thường.
- Topic publish của action chính là **`cellId`**; `subscribe("todos", …)` ăn khớp vì cell id là
  `todos`.
- Broker/presence là **in-memory bản 1-node**. Scale nhiều node → thay bằng NATS/Redis fan-out
  *cùng interface*, code cell không đổi.
- `subscribe` no-op an toàn khi không có `EventSource` (vd môi trường SSR/Node) — trả hàm rỗng.
- Presence dùng **refcount theo `id`** nên một user mở nhiều tab vẫn chỉ tính một thành viên,
  chỉ rời khỏi danh sách khi tab cuối đóng.
