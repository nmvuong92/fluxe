// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx init [<name>] — scaffold project workspace member: <name>/backend (module=plugin) +
 * <name>/frontend (feature) + package.json/tsconfig riêng. Mặc định name=app.
 * Cờ: --driver=memory|sqlite|postgres · --server=express|fastify · --auth. Không ghi đè file đã có. */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const H = "// Copyright (c) 2026 nmvuong92\n// SPDX-License-Identifier: Apache-2.0\n";
const arg = (k: string, def: string) => (process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1]) ?? def;
const proj = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "app";   // tên project (thư mục)
const driver = arg("driver", "memory");
const server = arg("server", "fastify");
const auth = process.argv.includes("--auth");
const apiOnly = process.argv.includes("--api");   // API-only (headless REST) vs fullstack (mặc định)

function ensure(rel: string, content: string) {   // rel = đường dẫn trong project → prefix proj/
  const path = join(proj, rel);
  if (existsSync(path)) { console.log(`  bỏ qua (đã có): ${path}`); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`  tạo: ${path}`);
}

// ══ API-ONLY MODE: backend REST thuần (0 frontend/cell), CRUD resource + OpenAPI/Bruno + /docs ══
if (apiOnly) {
  ensure("package.json", JSON.stringify({
    name: proj, private: true, type: "module",
    scripts: {
      dev: "node --experimental-sqlite --import tsx --watch backend/server.ts",
      test: "node --experimental-sqlite --import tsx --test 'backend/**/*.test.ts'",
      openapi: "fx openapi",
    },
    dependencies: { "@nmvuong92/fluxe": "*", zod: "^3", fastify: "^5", graphql: "^16", "graphql-yoga": "^5" },
  }, null, 2) + "\n");
  ensure("tsconfig.json", JSON.stringify({
    compilerOptions: {
      target: "ES2022", module: "ESNext", moduleResolution: "Bundler",
      strict: true, esModuleInterop: true, skipLibCheck: true, noEmit: true,
      erasableSyntaxOnly: true, allowImportingTsExtensions: true, types: ["node"], lib: ["ES2022"],
      paths: { "@backend/*": ["./backend/*"] },
    },
    include: ["backend/**/*"],
  }, null, 2) + "\n");
  ensure("backend/env.ts", `${H}export const env = { PORT: Number(process.env.PORT ?? 5180), NODE_ENV: process.env.NODE_ENV ?? "development" };\n`);
  ensure("backend/db.ts", `${H}/* Driver MEMORY (CRUD resource). Đổi driver = thay file này, module KHÔNG đổi. */
export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  name: string;
  list(): Promise<Todo[]>;
  get(id: string): Promise<Todo | null>;
  add(title: string): Promise<Todo>;
  update(id: string, title: string): Promise<Todo | null>;
  remove(id: string): Promise<boolean>;
}
export function makeDb(): TodoStore {
  const todos = new Map<string, Todo>(); let seq = 0;
  return {
    name: "memory",
    async list() { return [...todos.values()]; },
    async get(id) { return todos.get(id) ?? null; },
    async add(title) { const t = { id: String(++seq), title, done: false }; todos.set(t.id, t); return t; },
    async update(id, title) { const t = todos.get(id); if (!t) return null; t.title = title; return t; },
    async remove(id) { return todos.delete(id); },
  };
}
`);
  // module: api/ (contract REST + resolver) + domain/ (service) + entry
  ensure("backend/modules/todos/contract.ts", `${H}import { f } from "@nmvuong92/fluxe";
const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
// 1 khai báo → typed /__rpc + REST versioned + GraphQL. Đổi v1→v2 = sửa path.
export const todosContract = f.contract({
  listTodos:  f.query(Todo.array(),                              { rest: { method: "GET",    path: "/v1/todos" } }),
  getTodo:    f.query(Todo.nullable(), { input: { id: f.string }, rest: { method: "GET", path: "/v1/todos/:id" } }),
  addTodo:    f.mutation({ title: f.string }, Todo,              { rest: { method: "POST",   path: "/v1/todos" } }),
  updateTodo: f.mutation({ id: f.string, title: f.string }, Todo.nullable(), { rest: { method: "PUT", path: "/v1/todos/:id" } }),
  removeTodo: f.mutation({ id: f.string }, f.bool,              { rest: { method: "DELETE", path: "/v1/todos/:id" } }),
});
`);
  ensure("backend/modules/todos/todos.module.ts", `${H}import { defineModule } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./contract.ts";
// Resolver KHAI BÁO — ctx.db (repository) tiêm qua \`use\`. 1 resolver → RPC + REST + GraphQL.
// Phức tạp lên? tách domain/rules.ts · application/*.usecase.ts — xem guides/data-layer.
export default defineModule<{ db: TodoStore }>({
  name: "todos",
  contract: todosContract,
  use: { db: "backend" },
  resolvers: {
    listTodos: (_, { db }) => db.list(),
    getTodo: ({ id }: { id: string }, { db }) => db.get(id),
    addTodo: ({ title }: { title: string }, { db }) => db.add(title.trim()),
    updateTodo: ({ id, title }: { id: string; title: string }, { db }) => db.update(id, title),
    removeTodo: ({ id }: { id: string }, { db }) => db.remove(id),
  },
});
`);
  ensure("backend/contract.ts", `${H}import { todosContract } from "./modules/todos/contract.ts";
export const contract = { ...todosContract };
`);
  ensure("backend/app.ts", `${H}import { createApp, resolve } from "@nmvuong92/fluxe";
import { makeDb } from "./db.ts";
import todos from "./modules/todos/todos.module.ts";
export async function makeApp() {
  const store = makeDb();
  const manifest = resolve([], { name: "api" });   // API-only: 0 cell → manifest rỗng (in-process)
  const app = await createApp({ manifest, cells: [], plugins: [todos], backend: store });
  return { app, store, manifest };
}
`);
  ensure("backend/server.ts", `${H}import Fastify from "fastify";
import { fluxe } from "@nmvuong92/fluxe/fastify";
import { toOpenApi, swaggerHtml } from "@nmvuong92/fluxe/openapi";
import { graphqlHandler } from "@nmvuong92/fluxe/graphql";
import { makeApp } from "./app.ts";
import { contract } from "./contract.ts";
import { env } from "./env.ts";
const { app, store, manifest } = await makeApp();
const server = Fastify();
// 1 contract → OpenAPI + Bruno + GraphQL + REST + typed RPC (không trùng lặp).
server.get("/openapi.json", () => toOpenApi(contract, { title: "${proj}", version: "1.0.0" }));
server.get("/docs", (_req, reply) => reply.type("text/html").send(swaggerHtml("${proj}", "/openapi.json")));
const gql = graphqlHandler(contract, app.resolvers);   // /graphql + GraphiQL
server.route({ method: ["GET", "POST", "OPTIONS"], url: "/graphql", handler: (req, reply) => { reply.hijack(); gql(req.raw, reply.raw, () => { reply.raw.writeHead(404); reply.raw.end(); }); } });
await server.register(fluxe(manifest, [], {}, { backend: store, contract: app.contract, resolvers: app.resolvers }));
await server.listen({ port: env.PORT });
console.log(\`API @ http://localhost:\${env.PORT}  ·  /docs  ·  /graphql  ·  /openapi.json  ·  REST /v1/todos\`);
`);
  ensure("backend/tests/e2e/todos.e2e.test.ts", `${H}import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeApp } from "@backend/app.ts";
test("[api] CRUD REST /v1/todos (201 create, 200 list/get, 204 delete)", async () => {
  const { app } = await makeApp();
  const server = http.createServer(app.handler!);
  await new Promise<void>((r) => server.listen(0, r));
  const base = \`http://127.0.0.1:\${(server.address() as any).port}/v1/todos\`;
  const created = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "học fluxe" }) });
  assert.equal(created.status, 201);
  const todo: any = await created.json();
  const got: any = await (await fetch(\`\${base}/\${todo.id}\`)).json();
  assert.equal(got.title, "học fluxe");
  const del = await fetch(\`\${base}/\${todo.id}\`, { method: "DELETE" });
  assert.equal(del.status, 204);
  await new Promise<void>((r) => server.close(() => r()));
});
`);
  console.log(`\n[init] API project "${proj}" xong (REST /v1/todos + /docs + /openapi.json). Chạy: cd ${proj} && npm run dev`);
  process.exit(0);
}

// ── monorepo member: package.json + tsconfig ──────────────────────────────────
ensure("package.json", JSON.stringify({
  name: proj, private: true, type: "module",
  scripts: { dev: "fx dev", sync: "fx sync", resolve: "fx resolve", build: "fx build", test: "fx test" },
  dependencies: { "@nmvuong92/fluxe": "*", react: "^18", "react-dom": "^18", zod: "^3", ...(server === "fastify" ? { fastify: "^5" } : { express: "^5" }) },
}, null, 2) + "\n");
ensure("tsconfig.json", JSON.stringify({
  compilerOptions: {
    target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx",
    strict: true, esModuleInterop: true, skipLibCheck: true, noEmit: true,
    erasableSyntaxOnly: true, allowImportingTsExtensions: true, types: ["node"], lib: ["ES2022", "DOM"],
    paths: { "@backend/*": ["./backend/*"], "@frontend/*": ["./frontend/*"] },
  },
  include: ["backend/**/*", "frontend/**/*"],
}, null, 2) + "\n");
ensure("frontend/client.tsx", `${H}/* Client entry (project-owned) — bundle bởi \`fx build\`. Chỉ import view. */
import { hydrate } from "@nmvuong92/fluxe/react";
import { views } from "./views";
import { layouts } from "./layouts/index";
hydrate(views, layouts);
`);

// ── backend: db driver ──────────────────────────────────────────────────────
const DRIVERS: Record<string, string> = {
  memory: `${H}/* Driver MEMORY (0-dep, dev). Đổi driver = thay file này, module KHÔNG đổi. */
export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  name: string;
  list(): Promise<Todo[]>;
  add(title: string): Promise<Todo>;
  toggle(id: string): Promise<Todo | null>;
}
export function makeDb(): TodoStore {
  const todos: Todo[] = []; let seq = 0;
  return {
    name: "memory",
    async list() { return todos.slice(); },
    async add(title) { const t = { id: String(++seq), title, done: false }; todos.push(t); return t; },
    async toggle(id) { const t = todos.find((x) => x.id === id); if (t) t.done = !t.done; return t ?? null; },
  };
}
`,
  sqlite: `${H}/* Driver SQLite (node:sqlite — chạy: node --experimental-sqlite). Cùng interface TodoStore. */
import { DatabaseSync } from "node:sqlite";
export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  name: string;
  list(): Promise<Todo[]>;
  add(title: string): Promise<Todo>;
  toggle(id: string): Promise<Todo | null>;
}
export function makeDb(file = "app.db"): TodoStore {
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE IF NOT EXISTS todos(id INTEGER PRIMARY KEY, title TEXT, done INTEGER DEFAULT 0)");
  const row = (r: any): Todo => ({ id: String(r.id), title: r.title, done: !!r.done });
  return {
    name: "sqlite",
    async list() { return db.prepare("SELECT * FROM todos ORDER BY id").all().map(row); },
    async add(title) { const r = db.prepare("INSERT INTO todos(title) VALUES(?)").run(title); return { id: String(r.lastInsertRowid), title, done: false }; },
    async toggle(id) { db.prepare("UPDATE todos SET done = 1 - done WHERE id = ?").run(Number(id)); const r = db.prepare("SELECT * FROM todos WHERE id = ?").get(Number(id)); return r ? row(r) : null; },
  };
}
`,
  postgres: `${H}/* Driver Postgres (cài: npm i pg). Cùng interface TodoStore. Đặt DATABASE_URL. */
import { Pool } from "pg";
export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  name: string;
  list(): Promise<Todo[]>;
  add(title: string): Promise<Todo>;
  toggle(id: string): Promise<Todo | null>;
}
export function makeDb(url = process.env.DATABASE_URL): TodoStore {
  const pool = new Pool({ connectionString: url });
  const row = (r: any): Todo => ({ id: String(r.id), title: r.title, done: r.done });
  return {
    name: "postgres",
    async list() { const { rows } = await pool.query("SELECT * FROM todos ORDER BY id"); return rows.map(row); },
    async add(title) { const { rows } = await pool.query("INSERT INTO todos(title,done) VALUES($1,false) RETURNING *", [title]); return row(rows[0]); },
    async toggle(id) { const { rows } = await pool.query("UPDATE todos SET done = NOT done WHERE id=$1 RETURNING *", [id]); return rows[0] ? row(rows[0]) : null; },
  };
}
`,
  drizzle: `${H}/* Driver DRIZZLE (better-sqlite3). Cài: npm i drizzle-orm better-sqlite3. Cùng interface TodoStore
 * → module KHÔNG đổi. Type-safe, SQL-first, 0 codegen. Hooks EDA/trace ở seam resolver (ctx.publish/span). */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { eq, sql } from "drizzle-orm";

export const todos = sqliteTable("todos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  done: integer("done", { mode: "boolean" }).notNull().default(false),
});

export interface Todo { id: string; title: string; done: boolean }
export interface TodoStore {
  name: string;
  list(): Promise<Todo[]>;
  add(title: string): Promise<Todo>;
  toggle(id: string): Promise<Todo | null>;
}
const row = (r: any): Todo => ({ id: String(r.id), title: r.title, done: !!r.done });

export function makeDb(file = "app.db"): TodoStore {
  const db = drizzle(new Database(file));
  // ponytail: CREATE TABLE inline; nâng lên drizzle-kit migrations khi schema tiến hoá.
  db.run(sql\`CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)\`);
  return {
    name: "drizzle-sqlite",
    async list() { return db.select().from(todos).all().map(row); },
    async add(title) { return row(db.insert(todos).values({ title }).returning().get()); },
    async toggle(id) {
      const t = db.select().from(todos).where(eq(todos.id, Number(id))).get();
      if (!t) return null;
      db.update(todos).set({ done: !t.done }).where(eq(todos.id, Number(id))).run();
      return row({ ...t, done: !t.done });
    },
  };
}
`,
};
ensure("backend/db.ts", DRIVERS[driver] ?? DRIVERS.memory);

ensure("backend/env.ts", `${H}export const env = {
  PORT: Number(process.env.PORT ?? 5180),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
`);

// ── backend: module todos (starter FLAT — grow api/application/domain/infrastructure khi cần, xem guides/data-layer) ──
ensure("backend/modules/todos/contract.ts", `${H}import { f } from "@nmvuong92/fluxe";
const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
export const todosContract = f.contract({
  listTodos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
  toggleTodo: f.mutation({ id: f.string }, Todo.nullable()),
  onTodos: f.subscription(Todo.array()),
});
`);
ensure("backend/modules/todos/todos.module.ts", `${H}import { defineModule } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./contract.ts";

// ENTRY: mở file này hiểu cả module. Resolver KHAI BÁO — ctx.db (repository) tiêm qua \`use\` (0 make/thread).
// Phức tạp lên? tách domain/rules.ts · application/*.usecase.ts — xem guides/data-layer (promotion path).
export default defineModule<{ db: TodoStore }>({
  name: "todos",
  contract: todosContract,
  use: { db: "backend" },
  resolvers: {
    listTodos: (_, { db }) => db.list(),
    addTodo: async ({ title }: { title: string }, { db, publish }) => { const t = await db.add(title.trim()); publish("onTodos", await db.list()); return t; },
    toggleTodo: async ({ id }: { id: string }, { db, publish }) => { const t = await db.toggle(id); publish("onTodos", await db.list()); return t; },
  },
});
`);

// ── backend: contract tổng hợp + app + server ─────────────────────────────────
ensure("backend/contract.ts", `${H}import { todosContract } from "./modules/todos/contract.ts";
// Static spread → createHooks<typeof contract>() suy type ở frontend. Thêm module = spread thêm.
export const contract = { ...todosContract };
`);
ensure("backend/app.ts", `${H}import { readFileSync } from "node:fs";
import { createApp, type ResolutionManifest } from "@nmvuong92/fluxe";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeDb } from "./db.ts";
import todos from "./modules/todos/todos.module.ts";   // thêm module = import + thêm vào plugins
export async function makeApp() {
  const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
  const store = makeDb();
  // backend auto-provide capability "backend" → module.needs ["backend"] tự nhận (không thread tay).
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todos], backend: store });
  return { app, store, manifest };
}
`);

const SERVERS: Record<string, string> = {
  fastify: `${H}import Fastify from "fastify";
import { fluxe } from "@nmvuong92/fluxe/fastify";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeApp } from "./app.ts";
import { env } from "./env.ts";
const { app, store, manifest } = await makeApp();
const server = Fastify();
server.get("/api/todos", () => store.list());   // 👉 route riêng của bạn (trước fluxe)
await server.register(fluxe(manifest, cells, layouts, { i18n, backend: store, contract: app.contract, resolvers: app.resolvers }));
await server.listen({ port: env.PORT });
console.log(\`http://localhost:\${env.PORT} (Fastify · \${store.name})\`);
`,
  express: `${H}import express from "express";
import { fluxe } from "@nmvuong92/fluxe/express";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeApp } from "./app.ts";
import { env } from "./env.ts";
const { app, store, manifest } = await makeApp();
const server = express();
server.get("/api/todos", async (_req, res) => res.json(await store.list()));   // 👉 route riêng
server.use(fluxe(manifest, cells, layouts, { i18n, backend: store, contract: app.contract, resolvers: app.resolvers }));
server.listen(env.PORT, () => console.log(\`http://localhost:\${env.PORT} (Express · \${store.name})\`));
`,
};
ensure("backend/server.ts", SERVERS[server] ?? SERVERS.fastify);

// ── frontend: features + hạ tầng ─────────────────────────────────────────────
ensure("frontend/profiles.ts", `${H}import type { ResolutionProfile } from "@nmvuong92/fluxe";
export const profiles: Record<string, ResolutionProfile> = { dev: { name: "dev" }, prod: { name: "prod" } };
`);
ensure("frontend/i18n.ts", `${H}import { createI18n } from "@nmvuong92/fluxe";
export const i18n = createI18n({
  defaultLocale: "vi",
  catalogs: {
    vi: { "home.title": "fluxe starter", "home.cta": "Tới /todos →", "greet.hello": "Xin chào, {name}!", "greet.desc": "i18n: locale từ cookie / Accept-Language." },
    en: { "home.title": "fluxe starter", "home.cta": "Go to /todos →", "greet.hello": "Hello, {name}!", "greet.desc": "i18n: locale from cookie / Accept-Language." },
  },
});
`);
ensure("frontend/api.ts", `${H}import { createHooks } from "@nmvuong92/fluxe/react";
import type { contract } from "@backend/contract";
export const api = createHooks<typeof contract>();   // api.<op>.useQuery/useForm/useMutation/useSubscription
`);
ensure("frontend/layouts/site.tsx", `${H}import type { ReactNode } from "react";
import { LocaleSwitch, DebugBar } from "@nmvuong92/fluxe/react";
export function Site({ children, ctx }: { children: ReactNode; ctx?: any }) {
  return (
    <>
      <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "system-ui" }}>
        <header style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
          <strong>fluxe</strong>
          <LocaleSwitch locales={["vi", "en"]} current={ctx?.locale} />
        </header>
        {children}
      </main>
      <DebugBar />
    </>
  );
}
export default Site;
`);
ensure("frontend/layouts/index.ts", `${H}import type { LayoutMeta } from "@nmvuong92/fluxe";
import type { ReactNode } from "react";
import Site from "./site";
interface LayoutEntry extends LayoutMeta { component: (props: { children: ReactNode; ctx?: any }) => ReactNode }
export const layouts: Record<string, LayoutEntry> = { site: { id: "site", component: Site } };
`);

ensure("frontend/features/home/home.view.tsx", `${H}export interface HomeData { title: string; cta: string }
export function Home({ data }: { data: HomeData }) {
  return (<div className="card"><h1>{data.title}</h1><a href="/todos" className="btn">{data.cta}</a></div>);
}
export default Home;
`);
ensure("frontend/features/home/home.cell.tsx", `${H}import { defineCell } from "@nmvuong92/fluxe";
import { Home } from "./home.view";
export default defineCell({
  id: "home", route: "/", hydration: "static", layout: "site",
  async loader({ t }) { return { title: t!("home.title"), cta: t!("home.cta") }; },
  head: (d) => ({ title: d.title }), view: Home,
});
`);
ensure("frontend/features/greet/greet.view.tsx", `${H}export interface GreetData { hello: string; desc: string }
export function Greet({ data }: { data: GreetData }) {
  return (<div className="card"><h1>{data.hello}</h1><p className="muted">{data.desc}</p></div>);
}
export default Greet;
`);
ensure("frontend/features/greet/greet.cell.tsx", `${H}import { defineCell } from "@nmvuong92/fluxe";
import { Greet } from "./greet.view";
export default defineCell({
  id: "greet", route: "/greet", hydration: "static", layout: "site",
  async loader({ t }) { return { hello: t!("greet.hello", { name: "fluxe" }), desc: t!("greet.desc") }; },
  head: () => ({ title: "Greet" }), view: Greet,
});
`);
ensure("frontend/features/todos/todos.view.tsx", `${H}import { Link } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
export interface TodosData { todos: { id: string; title: string; done: boolean }[] }
export function Todos({ data }: { data: TodosData }) {
  const q = api.listTodos.useQuery({ initial: data.todos });
  const form = api.addTodo.useForm({ invalidates: ["listTodos"], onSuccess: () => form.reset() });
  const toggle = api.toggleTodo.useMutation({ invalidates: ["listTodos"] });
  api.onTodos.useSubscription(() => q.refetch());
  const todos = q.data ?? [];
  const title = form.register("title");
  const busy = form.submitting || toggle.loading || q.loading;
  return (
    <div className="card">
      <h1>Todos (island)</h1>
      <form className="row" onSubmit={form.handleSubmit}>
        <input {...title} placeholder="Việc mới..." disabled={busy} /><button type="submit" disabled={busy}>Thêm</button>
      </form>
      {form.errors.title ? <p style={{ color: "crimson" }}>{form.errors.title}</p> : null}
      <ul className="list">
        {todos.map((t) => (<li key={t.id} onClick={() => toggle.mutate({ id: t.id })} className={t.done ? "done" : ""}><span>{t.done ? "✓" : "○"}</span> {t.title}</li>))}
      </ul>
      <Link href="/" className="muted">← trang chủ (SPA nav)</Link>
    </div>
  );
}
export default Todos;
`);
ensure("frontend/features/todos/todos.cell.tsx", `${H}import { defineCell } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { Todos } from "./todos.view";
export default defineCell({
  id: "todos", route: "/todos", layout: "site",
  async loader({ backend }) { return { todos: await (backend as TodoStore).list() }; },
  head: () => ({ title: "Todos" }), view: Todos,
});
`);

// ── vùng test riêng ──────────────────────────────────────────────────────────
ensure("backend/tests/helpers/make-test-app.ts", `${H}import http from "node:http";
import { createApp, resolve } from "@nmvuong92/fluxe";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { i18n } from "@frontend/i18n";
import { profiles } from "@frontend/profiles";
import { makeDb } from "@backend/db";
import todos from "@backend/modules/todos/todos.module.ts";
export async function startTestServer() {
  const store = makeDb();
  const decls = cells.map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));
  const manifest = resolve(decls, profiles.dev);
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todos], backend: store });
  const server = http.createServer(app.handler!);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { port, store, close: () => new Promise<void>((r) => server.close(() => r())) };
}
`);
ensure("backend/tests/e2e/todos.e2e.test.ts", `${H}import { test } from "node:test";
import assert from "node:assert/strict";
import { startTestServer } from "../helpers/make-test-app.ts";
test("[e2e] addTodo rồi listTodos thấy todo", async () => {
  const { port, close } = await startTestServer();
  try {
    await fetch(\`http://127.0.0.1:\${port}/__rpc/addTodo\`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "học fluxe" }) });
    const todos = await (await fetch(\`http://127.0.0.1:\${port}/__rpc/listTodos\`, { method: "POST" })).json();
    assert.ok(todos.some((t: any) => t.title === "học fluxe"));
  } finally { await close(); }
});
`);

if (auth) {
  console.log("  (--auth) module auth mẫu — tích hợp provider của bạn qua @nmvuong92/fluxe/auth");
  ensure("backend/modules/auth/auth.plugin.ts", `${H}import { definePlugin } from "@nmvuong92/fluxe";
// Auth = INTEGRATION: bọc provider (better-auth/lucia/passport) + bridgeSession (mount TRƯỚC fluxe).
// Xem reference/auth. Plugin này chỗ để bạn đóng góp cell/route auth của app.
export const authPlugin = definePlugin({ name: "@app/auth" });
`);
}

console.log(`\n[init] scaffold xong: driver=${driver} · server=${server}${auth ? " · auth" : ""}. Chạy: fx dev`);
