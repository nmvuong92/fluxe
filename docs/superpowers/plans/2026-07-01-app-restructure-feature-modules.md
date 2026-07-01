# Tái cấu trúc app/ (backend+frontend feature-module) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển `app/` sang cấu trúc `app/backend` (feature-module = local plugin) + `app/frontend` (feature, `*.cell.tsx`/`*.view.tsx`) với vùng test riêng; `fx init` prompt driver/framework/auth; bỏ bidly → starter tối thiểu; `test:all` xanh.

**Architecture:** Engine đọc app qua alias `@backend`/`@frontend`. `scripts/sync.ts` quét `app/frontend/features/**/*.cell.tsx` sinh `app/frontend/registry.ts` (cells[]+views[]). Backend module gói `definePlugin`; `app/backend/app.ts` = `createApp({plugins})`. `selftest2` viết lại trỏ starter.

**Tech Stack:** TypeScript, node:test, tsx, esbuild, Fastify/Express, Zod, React 18 SSR.

## Global Constraints

- Header mọi file source mới: `// Copyright (c) 2026 nmvuong92` rồi `// SPDX-License-Identifier: Apache-2.0`.
- Test runner: `node --experimental-sqlite --import tsx --test <file>`. Unit dùng `node:test` + `assert/strict`.
- Gate: `npm run test:all` (sync + typecheck + unit + selftest2) phải xanh cuối mỗi phase.
- Cell 2-file: `<name>.view.tsx` phải `export function <Comp>` + `export default <Comp>` + `export interface <Comp>Data`. `<name>.cell.tsx` = `defineCell` (default export).
- Convention khoá: **cell.id === basename** của `<name>.cell.tsx` (registry key views theo id).
- Alias: `@backend/*`→`app/backend/*`, `@frontend/*`→`app/frontend/*`.
- Import package trong app: `@nmvuong92/fluxe` / `/react` / `/client` / `/fastify` / `/express` / `/auth`.
- Không monorepo tool; không `core/` layer; không giữ bidly.

---

## Phase 1 — Engine enablement

### Task 1: tsconfig alias @backend/@frontend

**Files:**
- Modify: `tsconfig.json` (block `paths`)

**Interfaces:**
- Produces: alias `@backend/*`, `@frontend/*` cho toàn repo.

- [ ] **Step 1: Thêm alias** vào `compilerOptions.paths` (sau dòng `"@nmvuong92/fluxe/fastify"`):

```json
      "@nmvuong92/fluxe/fastify": ["./src/adapters/fastify.ts"],
      "@backend/*": ["./app/backend/*"],
      "@frontend/*": ["./app/frontend/*"]
```

- [ ] **Step 2: Verify typecheck vẫn chạy** (chưa có app mới nên chỉ cần không lỗi cú pháp config)

Run: `npx tsc -p tsconfig.json --noEmit 2>&1 | head -5`
Expected: các lỗi "Cannot find module '../app/...'" là bình thường ở phase này (app chưa đổi) — KHÔNG có lỗi parse tsconfig.

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore(tsconfig): alias @backend/@frontend"
```

### Task 2: Tách logic quét cell của sync.ts thành hàm testable + layout mới

**Files:**
- Create: `scripts/sync-core.ts` (hàm thuần, testable)
- Create: `scripts/sync-core.test.ts`
- Modify: `scripts/sync.ts` (dùng hàm mới, ghi file)

**Interfaces:**
- Produces: `scanFeatures(root: string): { cells: CellEntry[] }` với `CellEntry = { id: string; feature: string; cellImport: string; viewImport: string; hasView: boolean }`; `renderRegistry(entries: CellEntry[]): string`.

- [ ] **Step 1: Viết test thất bại** `scripts/sync-core.test.ts`:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanFeatures, renderRegistry } from "./sync-core.ts";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "fx-"));
  const f = join(root, "features", "home");
  mkdirSync(f, { recursive: true });
  writeFileSync(join(f, "home.cell.tsx"), "export default {};");
  writeFileSync(join(f, "home.view.tsx"), "export default () => null;");
  return root;
}

test("scanFeatures tìm cell theo *.cell.tsx + view kèm", () => {
  const entries = scanFeatures(fixture());
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "home");
  assert.equal(entries[0].feature, "home");
  assert.equal(entries[0].hasView, true);
});

test("renderRegistry sinh import + cells[] + views map", () => {
  const out = renderRegistry(scanFeatures(fixture()));
  assert.match(out, /import homeCell from ".\/features\/home\/home.cell"/);
  assert.match(out, /import homeView from ".\/features\/home\/home.view"/);
  assert.match(out, /export const cells = \[homeCell\]/);
  assert.match(out, /home: homeView/);
});
```

- [ ] **Step 2: Chạy test — thất bại**

Run: `node --experimental-sqlite --import tsx --test scripts/sync-core.test.ts 2>&1 | grep -E "fail|MODULE_NOT_FOUND" | head`
Expected: FAIL — `Cannot find module './sync-core.ts'`.

- [ ] **Step 3: Viết `scripts/sync-core.ts`**:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Quét app/frontend/features/**/*.cell.tsx → dữ liệu để sinh registry (cells[]+views[]).
 * Convention: cell.id === basename của <name>.cell.tsx. Tách hàm thuần để test được. */
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface CellEntry { id: string; feature: string; hasView: boolean }

const ident = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_");

export function scanFeatures(root: string): CellEntry[] {
  const featuresDir = join(root, "features");
  if (!existsSync(featuresDir)) return [];
  const entries: CellEntry[] = [];
  for (const feat of readdirSync(featuresDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(featuresDir, feat.name);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".cell.tsx")).sort()) {
      const id = file.slice(0, -".cell.tsx".length);
      entries.push({ id, feature: feat.name, hasView: existsSync(join(dir, `${id}.view.tsx`)) });
    }
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

export function renderRegistry(entries: CellEntry[]): string {
  const cellImports = entries.map((e) => `import ${ident(e.id)}Cell from "./features/${e.feature}/${e.id}.cell";`).join("\n");
  const viewImports = entries.filter((e) => e.hasView).map((e) => `import ${ident(e.id)}View from "./features/${e.feature}/${e.id}.view";`).join("\n");
  const cellsArr = entries.map((e) => `${ident(e.id)}Cell`).join(", ");
  const viewsMap = entries.filter((e) => e.hasView).map((e) => `  ${JSON.stringify(e.id)}: ${ident(e.id)}View,`).join("\n");
  return `// AUTO-GENERATED bởi fx sync — đừng sửa tay.
import type { CellDef } from "@nmvuong92/fluxe";
${cellImports}
${viewImports}

export const cells: CellDef<any, any, any, any>[] = [${cellsArr}];
export const views: Record<string, any> = {
${viewsMap}
};
`;
}
```

- [ ] **Step 4: Chạy test — pass**

Run: `node --experimental-sqlite --import tsx --test scripts/sync-core.test.ts 2>&1 | grep -E "pass|fail" | head`
Expected: `pass 2`, `fail 0`.

- [ ] **Step 5: Viết lại `scripts/sync.ts`** dùng hàm mới, ghi `app/frontend/registry.ts`:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx sync — auto-discovery cell. Quét app/frontend/features/**/*.cell.tsx → sinh
 * app/frontend/registry.ts (cells[] + views[]). Codegen tĩnh (không glob runtime). */
import { writeFileSync } from "node:fs";
import { scanFeatures, renderRegistry } from "./sync-core.ts";

const ROOT = "app/frontend";
const entries = scanFeatures(ROOT);
writeFileSync(`${ROOT}/registry.ts`, renderRegistry(entries));
const missing = entries.filter((e) => !e.hasView).map((e) => e.id);
console.log(`[sync] ${entries.length} cell → app/frontend/registry.ts${missing.length ? ` ⚠ thiếu view: ${missing.join(", ")}` : ""}`);
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-core.ts scripts/sync-core.test.ts scripts/sync.ts
git commit -m "feat(sync): quét app/frontend/features/*.cell.tsx → registry.ts (TDD)"
```

### Task 3: resolve.ts + client.tsx trỏ layout mới

**Files:**
- Modify: `scripts/resolve.ts` (import)
- Modify: `src/client.tsx` (import)

**Interfaces:**
- Consumes: `@frontend/registry` (cells, views), `@frontend/profiles` (profiles), `@frontend/layouts` (layouts).

- [ ] **Step 1: Sửa `scripts/resolve.ts`** — đổi 2 dòng import đầu:

```typescript
import { profiles } from "../app/frontend/profiles";
import { cells as appCells } from "../app/frontend/registry";
```

- [ ] **Step 2: Sửa `src/client.tsx`** — đổi import layouts + views:

```typescript
import { layouts } from "../app/frontend/layouts/index";
import { views } from "../app/frontend/registry";          // CHỈ view (không server code)
```

- [ ] **Step 3: Commit** (chưa chạy được tới khi app mới tồn tại — Phase 2)

```bash
git add scripts/resolve.ts src/client.tsx
git commit -m "refactor(engine): resolve/client trỏ app/frontend/registry"
```

---

## Phase 2 — Starter app/ mới (wipe + regen)

> Sau phase này app cũ bị xoá; các task tự chứa toàn bộ nội dung file mới.

### Task 4: Xoá app/ cũ + dựng khung backend (db + env)

**Files:**
- Delete: toàn bộ `app/` cũ
- Create: `app/backend/db.ts`, `app/backend/env.ts`

**Interfaces:**
- Produces: `makeDb(): TodoStore` (memory driver mặc định) provide capability `"db"`; `env` typed.

- [ ] **Step 1: Xoá app cũ**

```bash
git rm -r app
```

- [ ] **Step 2: Tạo `app/backend/db.ts`** (driver memory mặc định — starter):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Tầng data starter — driver MEMORY (0-dep, dev). Đổi sang sqlite/postgres = thay file này,
 * module không đổi (interface giữ nguyên). fx init sinh driver theo lựa chọn. */
export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  list(): Promise<Todo[]>;
  add(title: string): Promise<Todo>;
  toggle(id: string): Promise<Todo | null>;
}

export function makeDb(): TodoStore {
  const todos: Todo[] = [];
  let seq = 0;
  return {
    async list() { return todos.slice(); },
    async add(title) { const t = { id: String(++seq), title, done: false }; todos.push(t); return t; },
    async toggle(id) { const t = todos.find((x) => x.id === id); if (t) t.done = !t.done; return t ?? null; },
  };
}
```

- [ ] **Step 3: Tạo `app/backend/env.ts`**:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export const env = {
  PORT: Number(process.env.PORT ?? 5180),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
```

- [ ] **Step 4: Commit**

```bash
git add -A app/backend/db.ts app/backend/env.ts
git commit -m "feat(app): khung backend starter (db memory + env), xoá app cũ"
```

### Task 5: Module todos (data-agnostic, definePlugin)

**Files:**
- Create: `app/backend/modules/todos/todos.contract.ts`
- Create: `app/backend/modules/todos/todos.service.ts`
- Create: `app/backend/modules/todos/todos.resolvers.ts`
- Create: `app/backend/modules/todos/todos.plugin.ts`

**Interfaces:**
- Consumes: `TodoStore` từ `@backend/db`.
- Produces: `todosContract`, `todosPlugin` (definePlugin, `needs:["db"]`), `makeTodosResolvers(store)`.

- [ ] **Step 1: `todos.contract.ts`**:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { f } from "@nmvuong92/fluxe";

export const todosContract = f.contract({
  listTodos: f.query(f.object({ id: f.string, title: f.string, done: f.bool }).array()),
  addTodo: f.mutation({ title: f.string }, f.object({ id: f.string, title: f.string, done: f.bool })),
  onTodos: f.subscription(f.object({ id: f.string, title: f.string, done: f.bool }).array()),
});
```

- [ ] **Step 2: `todos.service.ts`** (nghiệp vụ thuần trên TodoStore):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { TodoStore } from "@backend/db";

export function makeTodosService(store: TodoStore) {
  return {
    list: () => store.list(),
    add: (title: string) => store.add(title.trim()),
  };
}
```

- [ ] **Step 3: `todos.resolvers.ts`** (dùng ctx.publish cho subscription):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { Resolvers } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./todos.contract.ts";
import { makeTodosService } from "./todos.service.ts";

export function makeTodosResolvers(store: TodoStore): Resolvers<typeof todosContract> {
  const svc = makeTodosService(store);
  return {
    listTodos: () => svc.list(),
    addTodo: async ({ title }, ctx) => {
      const t = await svc.add(title);
      ctx.publish("onTodos", await svc.list());
      return t;
    },
  };
}
```

- [ ] **Step 4: `todos.plugin.ts`** (definePlugin gói contract + resolvers, cần db):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { definePlugin } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./todos.contract.ts";
import { makeTodosResolvers } from "./todos.resolvers.ts";

export function todosPlugin(store: TodoStore) {
  return definePlugin({
    name: "@app/todos",
    contract: todosContract,
    resolvers: makeTodosResolvers(store),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add app/backend/modules/todos
git commit -m "feat(app): module todos (contract/service/resolvers/plugin)"
```

### Task 6: app/backend contract tổng hợp + app.ts (createApp) + server.ts

**Files:**
- Create: `app/backend/contract.ts`
- Create: `app/backend/app.ts`
- Create: `app/backend/server.ts`

**Interfaces:**
- Consumes: `todosContract`, `todosPlugin`, `makeDb`, `createApp`, `fluxe` (fastify).
- Produces: `contract` (static spread — cho client type), `makeApp()` → `Promise<App>`.

- [ ] **Step 1: `contract.ts`** (static spread → giữ type cho client):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { todosContract } from "./modules/todos/todos.contract.ts";

// Static spread → createClient<typeof contract>() suy type (import type-only ở frontend).
export const contract = { ...todosContract };
```

- [ ] **Step 2: `app.ts`** (createApp gom plugin; export để test + server dùng):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { createApp, type ResolutionManifest } from "@nmvuong92/fluxe";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeDb } from "./db.ts";
import { todosPlugin } from "./modules/todos/todos.plugin.ts";

export async function makeApp() {
  const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
  const store = makeDb();
  return createApp({ manifest, cells, layouts, plugins: [todosPlugin(store)], backend: store });
}
```

- [ ] **Step 3: `server.ts`** (Fastify mount — default host):

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import Fastify from "fastify";
import { fluxe } from "@nmvuong92/fluxe/fastify";
import { readFileSync } from "node:fs";
import { createApp, type ResolutionManifest } from "@nmvuong92/fluxe";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeDb } from "./db.ts";
import { todosPlugin } from "./modules/todos/todos.plugin.ts";
import { env } from "./env.ts";

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const store = makeDb();
const app = await createApp({ manifest, cells, layouts, plugins: [todosPlugin(store)], backend: store });

const server = Fastify();
// 👉 Route Fastify riêng của bạn (trước fluxe):
server.get("/api/todos", () => store.list());
await server.register(fluxe(manifest, cells, layouts, { backend: store, contract: app.contract, resolvers: app.resolvers }));
await server.listen({ port: env.PORT });
console.log(`http://localhost:${env.PORT} (Fastify)`);
```

- [ ] **Step 4: Commit**

```bash
git add app/backend/contract.ts app/backend/app.ts app/backend/server.ts
git commit -m "feat(app): contract tổng hợp + createApp + Fastify server"
```

### Task 7: Frontend features (home, greet, todos) + layouts + i18n + profiles

**Files:**
- Create: `app/frontend/features/home/home.cell.tsx`, `home.view.tsx`
- Create: `app/frontend/features/greet/greet.cell.tsx`, `greet.view.tsx`
- Create: `app/frontend/features/todos/todos.cell.tsx`, `todos.view.tsx`
- Create: `app/frontend/layouts/index.ts`, `app/frontend/layouts/site.tsx`
- Create: `app/frontend/i18n.ts`, `app/frontend/profiles.ts`, `app/frontend/api.ts`

**Interfaces:**
- Consumes: `defineCell` (`@nmvuong92/fluxe`), `createClient` (`@nmvuong92/fluxe/client`), `type contract` (`@backend/contract`).
- Produces: cells default export (id === basename); `api` client typed.

- [ ] **Step 1: `home.view.tsx` + `home.cell.tsx`** (static, 0 JS):

```tsx
// app/frontend/features/home/home.view.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export interface HomeData { title: string; cta: string }
export function Home({ data }: { data: HomeData }) {
  return (<div className="card"><h1>{data.title}</h1><a href="/todos" className="btn">{data.cta}</a></div>);
}
export default Home;
```

```tsx
// app/frontend/features/home/home.cell.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import { Home } from "./home.view";
export default defineCell({
  id: "home",
  route: "/",
  hydration: "static",
  layout: "site",
  async loader({ t }) { return { title: t!("home.title"), cta: t!("home.cta") }; },
  head: (d) => ({ title: d.title }),
  view: Home,
});
```

- [ ] **Step 2: `greet.view.tsx` + `greet.cell.tsx`** (static + i18n):

```tsx
// app/frontend/features/greet/greet.view.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export interface GreetData { hello: string; desc: string }
export function Greet({ data }: { data: GreetData }) {
  return (<div className="card"><h1>{data.hello}</h1><p className="muted">{data.desc}</p></div>);
}
export default Greet;
```

```tsx
// app/frontend/features/greet/greet.cell.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import { Greet } from "./greet.view";
export default defineCell({
  id: "greet",
  route: "/greet",
  hydration: "static",
  layout: "site",
  async loader({ t }) { return { hello: t!("greet.hello", { name: "fluxe" }), desc: t!("greet.desc") }; },
  head: () => ({ title: "Greet" }),
  view: Greet,
});
```

- [ ] **Step 3: `todos.view.tsx` + `todos.cell.tsx`** (island + rpc + subscription):

```tsx
// app/frontend/features/todos/todos.view.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import { useSubscription } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
export interface TodosData { todos: { id: string; title: string; done: boolean }[] }
export function Todos({ data }: { data: TodosData }) {
  const [todos, setTodos] = useState(data.todos);
  useSubscription<typeof data.todos>("onTodos", (next) => setTodos(next));
  const form = api.addTodo.useForm({ initial: { title: "" } });
  return (
    <div className="card">
      <h1>Todos</h1>
      <ul>{todos.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
      <form {...form.props}><input name="title" placeholder="Việc mới" /><button type="submit">Thêm</button></form>
    </div>
  );
}
export default Todos;
```

```tsx
// app/frontend/features/todos/todos.cell.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import { Todos } from "./todos.view";
export default defineCell({
  id: "todos",
  route: "/todos",
  layout: "site",
  async loader({ backend }) { return { todos: await (backend as any).list() }; },
  head: () => ({ title: "Todos" }),
  view: Todos,
});
```

- [ ] **Step 4: `layouts/site.tsx` + `layouts/index.ts`**:

```tsx
// app/frontend/layouts/site.tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export function Site({ children }: { children: any }) {
  return (<main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>{children}</main>);
}
export default Site;
```

```typescript
// app/frontend/layouts/index.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import Site from "./site";
export const layouts = { site: { component: Site } };
```

- [ ] **Step 5: `i18n.ts` + `profiles.ts` + `api.ts`**:

```typescript
// app/frontend/i18n.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createI18n } from "@nmvuong92/fluxe";
export const i18n = createI18n({
  default: "vi",
  messages: {
    vi: { "home.title": "fluxe starter", "home.cta": "Tới /todos →", "greet.hello": "Xin chào, {name}!", "greet.desc": "i18n demo." },
    en: { "home.title": "fluxe starter", "home.cta": "Go to /todos →", "greet.hello": "Hello, {name}!", "greet.desc": "i18n demo." },
  },
});
```

```typescript
// app/frontend/profiles.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export const profiles = { name: "default" };
```

```typescript
// app/frontend/api.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createClient } from "@nmvuong92/fluxe/client";
import type { contract } from "@backend/contract";
export const api = createClient<typeof contract>();
```

- [ ] **Step 6: Chạy sync + resolve + typecheck**

Run: `npm run sync && npm run resolve && npx tsc -p tsconfig.json --noEmit 2>&1 | grep -E "error TS" | head`
Expected: registry sinh ra, 0 `error TS`. (Sửa import/tên nếu lỗi — lặp tới sạch.)

- [ ] **Step 7: Commit**

```bash
git add app/frontend
git commit -m "feat(app): frontend features (home/greet/todos) + layouts/i18n/api/profiles"
```

---

## Phase 3 — Test area + selftest2

### Task 8: Test helpers + unit + e2e mẫu

**Files:**
- Create: `app/backend/tests/helpers/make-test-app.ts`
- Create: `app/backend/tests/unit/todos.service.test.ts`
- Create: `app/backend/tests/e2e/todos.e2e.test.ts`

**Interfaces:**
- Consumes: `makeDb`, `makeTodosService`, `makeApp`.
- Produces: `startTestServer(): Promise<{ port; close }>`.

- [ ] **Step 1: `helpers/make-test-app.ts`**:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import http from "node:http";
import { makeApp } from "@backend/app";

export async function startTestServer() {
  const app = await makeApp();
  const server = http.createServer(app.handler!);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { port, close: () => new Promise<void>((r) => server.close(() => r())) };
}
```

- [ ] **Step 2: Viết + chạy unit test (fail trước)** `tests/unit/todos.service.test.ts`:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDb } from "@backend/db";
import { makeTodosService } from "@backend/modules/todos/todos.service.ts";

test("service.add rồi list trả todo vừa thêm", async () => {
  const svc = makeTodosService(makeDb());
  await svc.add("  mua sữa  ");
  const all = await svc.list();
  assert.equal(all.length, 1);
  assert.equal(all[0].title, "mua sữa");   // trim
});
```

Run: `node --experimental-sqlite --import tsx --test app/backend/tests/unit/todos.service.test.ts 2>&1 | grep -E "pass|fail"`
Expected: `pass 1` (service đã tồn tại từ Task 5 — test xác nhận hành vi trim).

- [ ] **Step 3: Viết e2e** `tests/e2e/todos.e2e.test.ts`:

```typescript
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "../helpers/make-test-app.ts";

test("[e2e] POST /__rpc/addTodo rồi listTodos thấy todo", async () => {
  const { port, close } = await startTestServer();
  try {
    await fetch(`http://127.0.0.1:${port}/__rpc/addTodo`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "học fluxe" }),
    });
    const res = await fetch(`http://127.0.0.1:${port}/__rpc/listTodos`, { method: "POST" });
    const todos = await res.json();
    assert.equal(res.status, 200);
    assert.ok(todos.some((t: any) => t.title === "học fluxe"));
  } finally { await close(); }
});
```

Run: `npm run resolve && node --experimental-sqlite --import tsx --test app/backend/tests/e2e/todos.e2e.test.ts 2>&1 | grep -E "pass|fail"`
Expected: `pass 1`.

- [ ] **Step 4: Commit**

```bash
git add app/backend/tests
git commit -m "test(app): helper make-test-app + unit todos.service + e2e /__rpc"
```

### Task 9: Viết lại selftest2 trỏ starter mới

**Files:**
- Modify: `src/selftest2.ts` (bỏ mọi ref bidly/lots/greet-cũ; test starter: static home/greet, island todos, /__rpc, SSE, i18n)

**Interfaces:**
- Consumes: `makeApp` (`@backend/app`) hoặc `createHandler` + registry.

- [ ] **Step 1: Đọc selftest2 hiện tại để giữ khung assert engine**

Run: `sed -n '1,60p' src/selftest2.ts`
Expected: thấy cách nó dựng server + assert. Giữ pattern, đổi nguồn cells sang `@frontend/registry` + backend `makeDb`.

- [ ] **Step 2: Sửa selftest2** — thay import app cũ bằng:

```typescript
import { cells } from "../app/frontend/registry";
import { layouts } from "../app/frontend/layouts/index";
import { i18n } from "../app/frontend/i18n";
import { makeDb } from "../app/backend/db";
import { contract } from "../app/backend/contract";
import { makeTodosResolvers } from "../app/backend/modules/todos/todos.resolvers";
```
và các assert đổi: home `/` (static, title "fluxe starter"), `/greet` static không JS, `/todos` island có client.js, `/__rpc/listTodos` trả mảng, `/__rpc/addTodo` publish `onTodos` (SSE nhận). Bỏ mọi test lots/bid/auth-bidly.

- [ ] **Step 3: Chạy selftest2**

Run: `npm run resolve && npm run build:client && node --experimental-sqlite --import tsx src/selftest2.ts 2>&1 | tail -20`
Expected: mọi dòng `✓`, `fail 0`. (Lặp sửa tới xanh.)

- [ ] **Step 4: Full gate**

Run: `npm run test:all >/tmp/ta.log 2>&1; echo "EXIT $?"; grep -iE "error TS|fail [1-9]|✖" /tmp/ta.log | head`
Expected: `EXIT 0`, không lỗi.

- [ ] **Step 5: Commit**

```bash
git add src/selftest2.ts
git commit -m "test(selftest2): viết lại trỏ starter mới (bỏ bidly)"
```

---

## Phase 4 — fx init/new + docs

### Task 10: scripts/init.ts prompt driver/framework/auth + layout mới

**Files:**
- Modify: `scripts/init.ts` (sinh app/backend + app/frontend feature-module; prompt 3 trục)

**Interfaces:**
- Consumes: argv `--driver=memory|sqlite|postgres`, `--server=express|fastify`, `--auth`.

- [ ] **Step 1: Đọc init.ts hiện tại**

Run: `sed -n '1,70p' scripts/init.ts`
Expected: thấy hàm `ensure(path, content)` + cấu trúc sinh. Giữ helper.

- [ ] **Step 2: Sửa init.ts** — sinh các file starter y hệt Task 4-7 (db theo `--driver`, server theo `--server`, thêm module auth nếu `--auth`). Dùng cùng nội dung file đã viết ở trên (DRY: copy chính xác từ Task 4-7). Đổi `SERVERS` map thành sinh cả cây `app/backend/*` + `app/frontend/*`.

- [ ] **Step 3: Test scaffold trong thư mục tạm**

Run: `mkdir -p /tmp/fxinit && (cd /tmp/fxinit && node --import tsx /Users/vuong/projects/fluxe/bin/fx.ts init --server=fastify --driver=memory) 2>&1 | tail; ls -R /tmp/fxinit/app | head -30`
Expected: cây `app/backend/modules/todos`, `app/frontend/features/...` sinh đúng.

- [ ] **Step 4: Commit**

```bash
git add scripts/init.ts
git commit -m "feat(fx): init prompt driver/framework/auth + sinh layout feature-module"
```

### Task 11: Cập nhật fx new (sinh *.cell.tsx/*.view.tsx theo feature)

**Files:**
- Modify: `bin/fx.ts` hoặc script `fx new` (tìm bằng `grep -rn "fx new\|newCell" bin scripts`)

- [ ] **Step 1: Tìm generator `fx new`**

Run: `grep -rniE "new|scaffold cell" bin/fx.ts scripts/*.ts | head`
Expected: xác định file + hàm sinh cell.

- [ ] **Step 2: Sửa** để `fx new <feature>/<name>` sinh `app/frontend/features/<feature>/<name>.cell.tsx` + `<name>.view.tsx` (template tối thiểu, id=`<name>`). Giữ flag `--static`.

- [ ] **Step 3: Test**

Run: `node --import tsx bin/fx.ts new demo/sample 2>&1; ls app/frontend/features/demo`
Expected: 2 file sinh; `npm run sync` thấy cell. Xoá thử sau: `rm -r app/frontend/features/demo`.

- [ ] **Step 4: Commit**

```bash
git add bin/fx.ts
git commit -m "feat(fx): new sinh *.cell.tsx/*.view.tsx theo feature"
```

### Task 12: Docs + CLAUDE.md convention

**Files:**
- Modify: `docs-site/.../reference/project-structure.mdx`, `guides/tutorial.mdx`, `guides/server-framework.mdx`, `reference/cells.md`
- Modify: `CLAUDE.md` (quy ước cell 2-file *.cell.tsx/*.view.tsx; ranh giới app/backend+frontend)
- Modify: `app/README.md` (mới, mô tả cấu trúc)

- [ ] **Step 1: Cập nhật `CLAUDE.md`** dòng "Cell tách 2 file": đổi `index.tsx`/`view.tsx` → `<name>.cell.tsx`/`<name>.view.tsx`; thêm mục cấu trúc `app/backend/modules` + `app/frontend/features`.

- [ ] **Step 2: Cập nhật project-structure.mdx + tutorial.mdx + cells.md** theo cây mới (copy từ spec §Cây thư mục).

- [ ] **Step 3: Build docs**

Run: `cd docs-site && npm run build 2>&1 | grep -iE "error|Complete" | tail -3`
Expected: `Complete!`, 0 error.

- [ ] **Step 4: Full gate + commit**

Run: `npm run test:all >/tmp/ta.log 2>&1; echo EXIT $?`
Expected: `EXIT 0`.

```bash
git add CLAUDE.md app/README.md docs-site
git commit -m "docs: cấu trúc app/ feature-module + quy ước *.cell.tsx"
```

---

## Self-Review (đã chạy)

- **Spec coverage:** monorepo=folder(Task1 alias) · backend module=plugin(Task5-6) · test riêng(Task8) · frontend feature(Task7) · fx init 3 trục(Task10) · bỏ bidly+selftest2(Task9) — đủ.
- **Placeholder:** không có TODO/TBD; mọi step có code/command thật.
- **Type consistency:** `makeDb→TodoStore`, `todosPlugin(store)`, `makeTodosResolvers(store)`, `makeApp()→app.handler/contract/resolvers`, registry `cells/views` — khớp xuyên task.
- **Rủi ro:** `api.addTodo.useForm`/`props` phải khớp API react thật (kiểm ở Task 7 Step 6 typecheck); nếu tên hook khác → sửa theo `src/react`. Release cuối = `major` (breaking cell convention).
