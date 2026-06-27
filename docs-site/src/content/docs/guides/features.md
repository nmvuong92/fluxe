---
title: Tổng quan tính năng
description: Mọi thứ core fluxe hỗ trợ — kèm ví dụ ngắn + link chi tiết. Trung thực cả phần chưa có.
sidebar:
  order: 1
---

Bản đồ "có gì dùng nấy". Mỗi mục là một tính năng **đã có trong core**, kèm ví dụ tối thiểu.
Phần [chưa hỗ trợ](#chưa-hỗ-trợ-roadmap) liệt kê trung thực thứ chưa làm.

## Cell & Routing
```tsx
defineCell({ id: "user", route: "/user/[id]", loader: ({ input }) => ({ id: input.id }), view: User });
```
Route động `[id]`, loader chạy server. → [Cells](/reference/cells/)

## Data & backend
```ts
const todo = await backend.addTodo(title);   // memory | sqlite | postgres
```
Cùng interface `Backend`, đổi bằng profile. → [Backends](/reference/data/)

## Contract DSL (cell↔backend)
```ts
import { f, type Infer } from "@nmvuong92/fluxe";
const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
export type Todo = Infer<typeof Todo>;
export const contract = f.contract({
  todos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
});
// types suy ra tức thì qua Infer<>/Resolvers<>; client typed: await api.todos()
```
Khai báo nghiệp vụ một nơi → types/validate/client/resolver suy ra qua inference (không codegen). DB ẩn sau resolver. → [Contract DSL](/reference/contract/)

## Server framework (Express/Hono/Nest)
```ts
import { fluxe } from "@nmvuong92/fluxe/express";
app.use(fluxe(manifest, cells, layouts, { backend }));   // hoặc /hono, /nest
```
Nhúng fluxe vào Express/Hono/Nest; hoặc `makeServer` (node:http) zero-config. → [Chọn server framework](/guides/server-framework/)

## Validation (Zod)
```ts
add: withInput(z.object({ title: z.string().min(1).max(200) }), async ({ input, backend }) => backend.addTodo(input.title))
```
Sai → `FluxeError 400` field-level. → [Validation](/reference/validation/)

## Typed errors
```ts
throw new FluxeError("forbidden", "Không cho phép", 403);   // unexpected → 500 + errorId, prod không leak
```
→ [Typed errors](/reference/errors/)

## Auth — session, password, CSRF, RBAC
```ts
signSession({ user, roles }, SECRET);  hashPassword(pw);  // + CSRF double-submit, cell.requireRole
defineCell({ id: "admin", requireRole: "admin", /* … */ });
```
→ [Session](/reference/session/) · [Password](/reference/password/) · [CSRF](/reference/csrf/) · [RBAC](/reference/rbac/)

## Rate limit
```ts
createRateLimiter({ capacity: 30, refillPerSec: 10 });   // token-bucket + LRU per-IP → 429
```
→ [Rate limit](/reference/rate-limit/)

## Env fail-fast
```ts
export const env = loadEnv(z.object({ PORT: z.coerce.number().default(5180) }));
```
→ [Env](/reference/env/)

## Realtime (SSE + pub/sub + presence)
```ts
broker.publish("todos", { action: "add", out });          // server
subscribe("todos", (data) => refetch());                   // client (SSE)
```
`GET /__sse/<topic>` + presence (ai online). → [Realtime](/reference/realtime/)

## Background jobs (queue bền + dead-letter)
```ts
const q = createQueue("./jobs.db"); q.enqueue("email", { to });
await drain(q, { email: async (p) => send(p) }, { maxAttempts: 3 });   // retry → dead-letter
```
→ [Jobs](/reference/jobs/)

## React: data fetching + SPA nav
```tsx
const { data } = useQuery("todos", () => rpc("todos", "list", {}), { initial });
const add = useMutation("todos.add", (t) => rpc("todos", "add", { title: t }));
<Link href="/about" preserveScroll>About</Link>   // SPA nav + scroll restoration
```
→ [Data fetching](/reference/data-fetching/) · [Navigation](/reference/navigation/)

## Layout, Theme, Navigation, i18n
```tsx
<Nav items={nav} /> <ThemeToggle /> <LocaleSwitch locales={["vi","en"]} current={ctx.locale} />
```
Master layout, theme light/dark + **i18n** (locale giải server, `t()` ở loader), nav active —
**chạy cả trên cell static**. Theme/locale resolve từ cookie → SSR đúng ngay (no-flash).
→ [Layout](/reference/layout/) · [Theme](/reference/theme/) · [Navigation](/reference/navigation/) · [i18n](/reference/i18n/)

## File storage (upload)
```tsx
import { upload } from "@nmvuong92/fluxe/client";
const { url } = await upload("file", input.files[0]);   // multipart + CSRF; driver local/S3/memory
```
Interface `Storage` switch bằng config (như Backend). → [File storage](/reference/storage/)

## SEO
```ts
head: (d) => ({ title: d.title, description, canonical: "/", og: {...}, jsonLd: {...} })
```
+ `/sitemap.xml`, `/robots.txt` tự sinh. → [SEO](/reference/seo/)

## Observability & Devtools
- `/_fluxe` portal · `/_fluxe/stats` (RAM/CPU) · `/_fluxe/requests` (ring buffer).
- DebugBar: chaos toggle, RCA badge, trace timing, copy-as-test.
- ETag/304 cho props. → [Observability](/reference/observability/) · [Devtools](/reference/devtools/)

## Performance (opt-in)
- [Cell static — 0 JS](/guides/static-cells/) + [Render cache](/guides/static-cache/).
- View-only client bundle (server code không ship xuống browser).

## Configuration (ENV)
```bash
FLUXE_RATELIMIT_CAPACITY=100 FLUXE_UPLOAD_MAX_BYTES=52428800 npm run dev   # override qua ENV
fx config   # in config đã giải (default ← ENV FLUXE_* ← override)
```
Mọi tham số core có default + override ENV, validate fail-fast. → [Configuration](/reference/configuration/)

## Container (DI lười)
```ts
const c = createContainer();
c.register("broker", () => createBroker());   // chưa tạo
c.get("broker");                              // lần đầu mới tạo + memoize (singleton)
```
Chỉ module được **dùng** mới bootstrap; engine lazy broker/presence. `/_fluxe/stats.bootstrapped`
liệt kê thứ đã tạo. → [Container](/reference/container/)

## CLI
```bash
fx new <id>   # scaffold cell ; fx init ; fx dev ; fx config ; fx bench
```
→ [CLI](/reference/cli/)

## Chưa hỗ trợ (roadmap)

Trung thực — **chưa có trong core**, đừng dùng nhầm:

| Tính năng | Trạng thái |
|-----------|-----------|
| **WebSocket** | ✗ — realtime hiện chỉ **SSE** (1 chiều server→client). WS hai chiều chưa có. |
| **Mail / SMTP** | ✗ — chưa có; có thể làm qua job queue + lib ngoài. |
| **Full-text search** | ✗ — chưa có engine search tích hợp. |

Muốn cái nào? Mở issue hoặc xem `idea.md` để biết hướng.
