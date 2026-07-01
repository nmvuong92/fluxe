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

function ensure(rel: string, content: string) {   // rel = đường dẫn trong project → prefix proj/
  const path = join(proj, rel);
  if (existsSync(path)) { console.log(`  bỏ qua (đã có): ${path}`); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`  tạo: ${path}`);
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
    allowImportingTsExtensions: true, types: ["node"], lib: ["ES2022", "DOM"],
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
};
ensure("backend/db.ts", DRIVERS[driver] ?? DRIVERS.memory);

ensure("backend/env.ts", `${H}export const env = {
  PORT: Number(process.env.PORT ?? 5180),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
`);

// ── backend: module todos ────────────────────────────────────────────────────
ensure("backend/modules/todos/todos.contract.ts", `${H}import { f } from "@nmvuong92/fluxe";
const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
export const todosContract = f.contract({
  listTodos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
  toggleTodo: f.mutation({ id: f.string }, Todo.nullable()),
  onTodos: f.subscription(Todo.array()),
});
`);
ensure("backend/modules/todos/todos.service.ts", `${H}import type { TodoStore } from "@backend/db";
export function makeTodosService(store: TodoStore) {
  return { list: () => store.list(), add: (title: string) => store.add(title.trim()), toggle: (id: string) => store.toggle(id) };
}
`);
ensure("backend/modules/todos/todos.resolvers.ts", `${H}import type { Resolvers } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./todos.contract.ts";
import { makeTodosService } from "./todos.service.ts";
export function makeTodosResolvers(store: TodoStore): Resolvers<typeof todosContract> {
  const svc = makeTodosService(store);
  return {
    listTodos: () => svc.list(),
    addTodo: async ({ title }, ctx) => { const t = await svc.add(title); ctx.publish("onTodos", await svc.list()); return t; },
    toggleTodo: async ({ id }, ctx) => { const t = await svc.toggle(id); ctx.publish("onTodos", await svc.list()); return t; },
  };
}
`);
ensure("backend/modules/todos/todos.plugin.ts", `${H}import { definePlugin } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./todos.contract.ts";
import { makeTodosResolvers } from "./todos.resolvers.ts";
export function todosPlugin(store: TodoStore) {
  return definePlugin({ name: "@app/todos", contract: todosContract, resolvers: makeTodosResolvers(store) });
}
`);

// ── backend: contract tổng hợp + app + server ─────────────────────────────────
ensure("backend/contract.ts", `${H}import { todosContract } from "./modules/todos/todos.contract.ts";
// Static spread → createHooks<typeof contract>() suy type ở frontend. Thêm module = spread thêm.
export const contract = { ...todosContract };
`);
ensure("backend/app.ts", `${H}import { readFileSync } from "node:fs";
import { createApp, type ResolutionManifest } from "@nmvuong92/fluxe";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeDb } from "./db.ts";
import { todosPlugin } from "./modules/todos/todos.plugin.ts";
export async function makeApp() {
  const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
  const store = makeDb();
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todosPlugin(store)], backend: store });
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
import { todosPlugin } from "@backend/modules/todos/todos.plugin.ts";
export async function startTestServer() {
  const store = makeDb();
  const decls = cells.map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));
  const manifest = resolve(decls, profiles.dev);
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todosPlugin(store)], backend: store });
  const server = http.createServer(app.handler!);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { port, store, close: () => new Promise<void>((r) => server.close(() => r())) };
}
`);
ensure("backend/tests/unit/todos.service.test.ts", `${H}import { test } from "node:test";
import assert from "node:assert/strict";
import { makeDb } from "@backend/db";
import { makeTodosService } from "@backend/modules/todos/todos.service.ts";
test("service.add trim title", async () => {
  const svc = makeTodosService(makeDb());
  await svc.add("  x  ");
  assert.equal((await svc.list())[0].title, "x");
});
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
