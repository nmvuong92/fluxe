# fluxe Plugin Ecosystem — `definePlugin` · `createApp` · batteries `@fluxe/*`

**Ngày:** 2026-07-01
**Trạng thái:** spec đã chốt tên + ranh giới qua hỏi-đáp, chờ user review trước khi plan.

## Mục tiêu

Dựng lớp **ecosystem** cho fluxe theo mô hình Laravel (batteries-included, plugin/module thêm
mà không phá core) **nhưng đúng tôn chỉ RCA**: core vẫn là **cầu nối** `node:http` zero-dep,
mọi battery sống ở **plugin first-party `@fluxe/*`** (package riêng, opt-in). fluxe cưới
**Fastify** làm host mặc định (trục Transport của RCA); vẫn giữ adapter express/hono/nest.

## Quyết định (chốt qua brainstorm)

1. **Batteries = plugin, KHÔNG phải core.** storage/queue/notification quay lại dưới dạng
   `@fluxe/*` plugin — KHÔNG nhét vào `src/` core. Dòng "GIỮ trong core" của CLAUDE.md giữ nguyên.
2. **Host mặc định = Fastify.** Viết adapter `@nmvuong92/fluxe/fastify`, `fx dev` default Fastify.
   Lý do: plugin-encapsulation của Fastify là cơ chế "add-in không rò vào core" tốt nhất Node;
   từ vựng "plugin" khớp `definePlugin`. Giữ express/hono/nest làm adapter (Transport neutral).
3. **Triết lý tên — tự-mô-tả > whimsical.** Laravel bắt học Echo=realtime/Horizon=queue. fluxe:
   tên package tự-mô-tả + scope `@fluxe/*` + một DNA "Driver sau interface" cho MỌI battery.
4. **Một mô hình tư duy: Driver.** Mọi battery = interface + nhiều driver + memory-default (dev
   0-config). Đúng trục "State driver" của RCA.

## Vocab (chốt)

| Khái niệm | Tên | Vì sao |
|-----------|-----|--------|
| Đơn vị mở rộng | `definePlugin()` → **Plugin** | khớp Fastify, phổ quát, 0 phải học |
| Bộ khung app | `createApp()` → **App** | thin composer trên `createHandler` sẵn có |
| Trừu tượng chung | **Driver** | một mô hình tư duy phủ hết batteries |

Ba battery đầu:

| Battery | Package | Driver / channel |
|---------|---------|------------------|
| Lưu trữ file/object | `@fluxe/store` | `memory · local · s3 · gcs` |
| Job queue nền | `@fluxe/queue` | `memory · redis(bullmq) · pg` |
| Notification hợp nhất | `@fluxe/signal` ⭐ | channel: `database · broadcast · mail · sms · push` |

`@fluxe/signal` là chỗ vượt Laravel: gộp Notification + Broadcasting + Echo thành MỘT khái niệm,
và channel `broadcast` **tái dùng broker/SSE core** (không reinvent realtime).

## `definePlugin`

Plugin = đơn vị khai báo, chỉ phụ thuộc contract public `@fluxe/core`; engine tiêm capability
nó cần (không với tay vào `src/`). RCA áp cho chính ecosystem.

```ts
interface Plugin {
  name: string;                 // "@fluxe/store" — namespace CHO cell.id / ENV / route (chống đụng)
  apiVersion: 1;                // hợp đồng plugin; engine fail-fast nếu lệch
  needs?: Capability[];         // ["db","broker"] — engine inject; topo-sort thứ tự boot
  provides?: Capability[];      // ["storage"] — capability plugin đăng ký cho plugin khác

  cells?: CellDef[];            // đóng góp route/cell
  contract?: Contract;          // op query/mutation/subscription typed
  resolvers?: Resolvers;        // handler cho op
  middleware?: Middleware[];    // host-neutral (chạy trong handler fluxe)
  config?: ZodSchema;           // ENV FLUXE_<NAME>_* — validate fail-fast
  migrations?: Migration[];     // nếu plugin sở hữu bảng
  commands?: FxCommand[];       // mở rộng CLI `fx`

  boot?(app: AppContext): void | Promise<void>;  // sau khi mọi plugin đăng ký, trước serve
}

export function definePlugin(p: Plugin): Plugin;   // validate apiVersion + name
```

**Guardrail (add-in không phá tôn chỉ):**
1. `apiVersion` semver riêng → core refactor không vỡ plugin.
2. `needs`/`provides` = capability-scoped DI; plugin cấm import engine nội bộ.
3. Namespace bắt buộc theo `name`: cell.id/route/ENV prefix → không đụng nhau.
4. `boot` chạy theo **topological sort** của `needs` (fail-fast nếu vòng lặp).

## `createApp`

Thin composer trên `createHandler` — KHÔNG thay core, chỉ gộp đóng góp plugin rồi gọi xuống.

```ts
const app = createApp({
  plugins: [
    store({ driver: "s3", bucket: env.S3_BUCKET }),
    queue({ driver: "redis", url: env.REDIS_URL }),
    signal({ channels: { mail: resend(), push: fcm() } }),
  ],
  backend, layouts, config,
});
// app.handler  : NodeHandler  → mount Fastify (default) / Express / Hono
// app.contract : Contract     → merge mọi op, TYPED xuyên plugin (Infer<>)
// app.commands : FxCommand[]  → fx nạp: `fx queue:work`, `fx store:link`…
```

Bên trong:
```
1. Validate + topo-sort plugins theo needs/provides (fail-fast vòng lặp).
2. Merge: cells[] ← ∪ plugin.cells ; contract ← merge ; config ← ∪ plugin.config.
3. Dựng capability registry (DI graph): storage/queue/signal từ driver đã resolve.
4. Chạy plugin.boot() theo thứ tự topo (đăng ký worker, migrate…).
5. return createHandler(manifest, cells, layouts, { backend, contract, resolvers, broker, config, caps }).
```

Fastify entry (default host):
```ts
// app/backend/server.ts (Fastify)
const fastify = Fastify();
await fastify.register(fluxeFastify, { app });   // @nmvuong92/fluxe/fastify: bọc app.handler
fastify.listen({ port: env.PORT });
```

## Batteries — một khuôn Driver duy nhất

### `@fluxe/store`
```ts
interface StorageDriver {
  put(key: string, body: Buffer | ReadableStream, opts?: PutOpts): Promise<{ key; size; etag }>;
  get(key: string): Promise<ReadableStream>;
  url(key: string, opts?: { expiresIn?: number }): Promise<string>;   // signed URL
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
// drivers: memory (dev) · local (fs) · s3 · gcs
```

### `@fluxe/queue`
```ts
interface QueueDriver {
  push<T>(job: string, data: T, opts?: { delay?; attempts?; backoff? }): Promise<JobId>;
  worker<T>(job: string, handler: (data: T) => Promise<void>, opts?: WorkerOpts): Disposable;
}
// drivers: memory (in-proc, dev) · redis (bullmq) · pg (không cần Redis)
// worker publish trạng thái qua broker CORE (tái dùng realtime), bắc cầu sang @fluxe/signal
```

### `@fluxe/signal` (flagship)
Một `Notification`, nhiều channel, fan-out. `broadcast` xài broker/SSE core → in-app realtime free.
```ts
interface Notification {
  channels(to: Notifiable): Channel[];      // ["database","broadcast","mail"]
  toDatabase?(to: Notifiable): object;
  toBroadcast?(to: Notifiable): object;     // → topic SSE core
  toMail?(to: Notifiable): MailMessage;
  toSms?(to: Notifiable): string;
  toPush?(to: Notifiable): PushMessage;
}
await notify(user, new BidWon(lot));        // engine đọc channels() → gọi từng channel driver
```
- channel driver = provider: `mail: smtp|ses|resend` · `sms: twilio` · `push: fcm|apns` ·
  `broadcast: sse(core)|pusher`.
- `database` channel + endpoint `/__signals` + hook `useSignals()` (react) → inbox in-app typed
  (đồng dạng `useSession`).

## Vì sao giữ đúng tôn chỉ

Core vẫn `node:http` zero-dep + đúng danh sách "GIỮ trong core" (cells/SSR/resolver/contract/
realtime/observability/seo/i18n/cache). Batteries ở `@fluxe/*` plugin — opt-in, mỗi cái là
Driver-sau-interface (RCA), memory-default dev 0-config. Không thứ nào nhét lại vào core.

## Lộ trình (đề xuất)

1. `@fluxe/core`: `definePlugin` + `createApp` + capability registry + topo-sort (nền của mọi thứ).
2. `@nmvuong92/fluxe/fastify` adapter + chuyển `fx dev` default Fastify (đo latency vs Express).
3. `@fluxe/store` (memory + local + s3 trước).
4. `@fluxe/queue` (memory + redis) — migrate demo bidly khỏi bullmq trực tiếp sang plugin.
5. `@fluxe/signal` (database + broadcast + mail) — dùng broker core cho broadcast.

## Phạm vi thay đổi CLAUDE.md

Cập nhật dòng 47: phân biệt **core (bridge, KHÔNG batteries)** vs **`@fluxe/*` (batteries =
plugin first-party)**. storage/jobs/notification KHÔNG vào `src/` core — chúng là plugin. Thêm
mục ranh giới cho `definePlugin`/`createApp`/Driver-pattern.
