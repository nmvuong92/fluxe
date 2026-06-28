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

## Auth/CSRF/rate-limit/upload/jobs = việc của HOST

fluxe là **cầu nối RCA** — nó mount như middleware vào host framework (Express/Hono/Nest)
và lo cells/SSR/contract/realtime/observability. Những vấn đề xuyên suốt còn lại do **host +
ecosystem** lo, mount **TRƯỚC** fluxe:

| Cần | Dùng ở host (ví dụ) |
|-----|---------------------|
| Auth / login / session | `passport`, `lucia`, session middleware của host |
| CSRF | `csurf` / middleware host |
| Rate-limit | `express-rate-limit`, middleware host |
| Upload file | `multer` / middleware host |
| Background jobs / queue | `bullmq`, `pg-boss`… |

Engine endpoints (`/__rpc`, `/__action`) **không** tự kiểm CSRF/rate-limit — middleware host
phía trước lo. `ctx.session` là do host gắn (`req.session`); fluxe **không verify**, chỉ đọc.
Guard `requireAuth`/`requireRole` ở cell đọc đúng session đó. → [Cells](/reference/cells/)

## Auth integration (`@nmvuong92/fluxe/auth`)

fluxe **không reinvent auth** — provider (better-auth/lucia/passport) lo OAuth/password/session.
fluxe cho **lớp tích hợp RCA-native**: `bridgeSession(getSession)` gắn `req.session` typed,
guard khai báo cell `requireRole` + contract op `{ auth }`, hook `useSession()`, `protect()` cho
route host.

```ts
import { bridgeSession } from "@nmvuong92/fluxe/auth";
app.use(bridgeSession((req) => auth.api.getSession({ headers: req.headers }))); // TRƯỚC fluxe
```

Session có kiểu xuyên cell qua `createCells<Backend, AppSession>()`. → [Auth](/reference/auth/)

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

## React: data fetching + forms + SPA nav

`createHooks<typeof contract>()` bind hook vào contract (typed, 0 schema xuống browser):
```tsx
const api = createHooks<AppContract>();
const q = api.todos.useQuery({ initial });                          // cache + dedup + refetch
const form = api.addTodo.useForm({ invalidates: ["todos"] });       // field typed; lỗi server → field
const toggle = api.toggleTodo.useMutation({ invalidates: ["todos"], optimistic });
<DataTable rows={q.data} columns={cols} />                          // view template tái dùng (bảng typed)
<Link href="/about" preserveScroll>About</Link>                     // SPA nav + scroll restoration
```
→ [Data fetching](/reference/data-fetching/) · [Navigation](/reference/navigation/)

## Layout, Theme, Navigation, i18n
```tsx
<Nav items={nav} /> <ThemeToggle /> <LocaleSwitch locales={["vi","en"]} current={ctx.locale} />
```
Master layout, theme light/dark + **i18n** (locale giải server, `t()` ở loader), nav active —
**chạy cả trên cell static**. Theme/locale resolve từ cookie → SSR đúng ngay (no-flash).
→ [Layout](/reference/layout/) · [Theme](/reference/theme/) · [Navigation](/reference/navigation/) · [i18n](/reference/i18n/)

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
FLUXE_RENDERCACHE_MAX_KEYS=512 FLUXE_LOCALE_DEFAULT=vi npm run dev   # override qua ENV
fx config   # in config đã giải (default ← ENV FLUXE_* ← override)
```
Mọi tham số core có default + override ENV, validate fail-fast. → [Configuration](/reference/configuration/)

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
| **Mail / SMTP** | ✗ — chưa có; làm ở host bằng lib ngoài (nodemailer…). |
| **Full-text search** | ✗ — chưa có engine search tích hợp. |

Muốn cái nào? Mở issue hoặc xem `idea.md` để biết hướng.
