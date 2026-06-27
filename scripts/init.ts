// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx init — scaffold app/ cho project mới. CHỈ tạo file còn thiếu (không ghi đè). An toàn
 * chạy trên repo đã có app/ (sẽ báo "đã có, bỏ qua"). Sau cùng sync để đăng ký cell. */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { execSync } from "node:child_process";

function ensure(path: string, content: string) {
  if (existsSync(path)) { console.log(`· đã có, bỏ qua: ${path}`); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`✓ tạo ${path}`);
}

ensure("app/env.ts", `import { z } from "zod";
import { loadEnv } from "@nmvuong92/fluxe";

export const env = loadEnv(
  z.object({
    PORT: z.coerce.number().int().positive().default(5180),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    FLUXE_SECRET: z.string().min(8).default("dev-secret-change-me"),
  }),
);
`);

ensure("app/profiles.ts", `import type { ResolutionProfile } from "@nmvuong92/fluxe";

// Profile chỉ resolve RENDER (static/island). Data = app/backend.ts.
export const profiles: Record<string, ResolutionProfile> = {
  dev: { name: "dev" },
};
`);

// Tầng data CỦA BẠN: định nghĩa interface domain + implement CRUD. Engine KHÔNG biết gì về data.
ensure("app/backend.ts", `// Interface domain + implement = của bạn. Inject qua makeServer(..., { backend }).
export interface Todo { id: string; title: string; done: boolean }
export interface Backend {
  name: string;
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
}

// In-memory cho khởi đầu — đổi sang node:sqlite / pg / ORM của bạn khi cần.
export function memoryBackend(): Backend {
  let todos: Todo[] = [];
  let seq = 1;
  return {
    name: "memory",
    async listTodos() { return todos; },
    async addTodo(title) {
      const t: Todo = { id: String(seq++), title, done: false };
      todos = [...todos, t];
      return t;
    },
  };
}

export const backend: Backend = memoryBackend();
`);

// SERVER ENTRY — chọn framework qua --server (express | hono | nest), mặc định express.
const serverArg = (process.argv.find((a) => a.startsWith("--server=")) ?? "--server=express").split("=")[1];
const SERVERS: Record<string, string> = {
  express: `import express from "express";
import { readFileSync } from "node:fs";
import { fluxe } from "@nmvuong92/fluxe/express";
import type { ResolutionManifest } from "@nmvuong92/fluxe";
import { cells } from "./app";
import { layouts } from "./layouts/index";
import { backend } from "./backend";

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const app = express();
// 👉 Route Express riêng của bạn đặt ở đây (chạy trước fluxe).
app.use(fluxe(manifest, cells, layouts, { backend }));   // fluxe = catch-all
app.listen(5180, () => console.log("http://localhost:5180 (Express)"));
`,
  hono: `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { fluxe } from "@nmvuong92/fluxe/hono";
import type { ResolutionManifest } from "@nmvuong92/fluxe";
import { cells } from "./app";
import { layouts } from "./layouts/index";
import { backend } from "./backend";

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const app = new Hono();
// 👉 Route Hono riêng của bạn đặt ở đây (chạy trước fluxe).
app.use("*", fluxe(manifest, cells, layouts, { backend }));
serve({ fetch: app.fetch, port: 5180 });
console.log("http://localhost:5180 (Hono)");
`,
  nest: `import "reflect-metadata";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { readFileSync } from "node:fs";
import { fluxeMiddleware } from "@nmvuong92/fluxe/nest";
import type { ResolutionManifest } from "@nmvuong92/fluxe";
import { cells } from "./app";
import { layouts } from "./layouts/index";
import { backend } from "./backend";

@Module({})
class AppModule {}

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const app = await NestFactory.create(AppModule);
// 👉 Controller/route Nest riêng của bạn; fluxe mount global catch-all:
app.use(fluxeMiddleware(manifest, cells, layouts, { backend }));
await app.listen(5180);
console.log("http://localhost:5180 (Nest)");
`,
};
ensure("app/server.ts", SERVERS[serverArg] ?? SERVERS.express);

// Design tokens — CSS biến. "auto" theo OS (prefers-color-scheme); [data-theme] ép light/dark.
ensure("app/theme.ts", `export const themeCSS = \`
:root {
  --bg: #ffffff; --fg: #1a1a2e; --muted: #6b7280; --accent: #4f46e5;
  --card: #f8f9fc; --border: #e5e7eb; --radius: 10px;
  --font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e; --accent: #7c83ff;
    --card: #161b22; --border: #30363d;
  }
}
[data-theme="dark"] { --bg:#0d1117; --fg:#e6edf3; --muted:#8b949e; --accent:#7c83ff; --card:#161b22; --border:#30363d; }
[data-theme="light"] { --bg:#fff; --fg:#1a1a2e; --muted:#6b7280; --accent:#4f46e5; --card:#f8f9fc; --border:#e5e7eb; }

* { box-sizing: border-box; }
body { margin: 0; font-family: var(--font); background: var(--bg); color: var(--fg); }
.shell { max-width: 880px; margin: 0 auto; padding: 0 20px; }
.site-header { display:flex; align-items:center; gap:16px; padding:14px 0; border-bottom:1px solid var(--border); }
.brand { font-weight: 700; font-size: 18px; color: var(--fg); text-decoration:none; }
.nav { display:flex; gap:14px; flex:1; }
.nav-link { color: var(--muted); text-decoration:none; }
.nav-link.active { color: var(--accent); font-weight:600; }
.theme-toggle { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:4px 10px; cursor:pointer; font-size:15px; }
.card { background:var(--card); border:1px solid var(--border); border-radius:var(--radius); padding:20px; margin:20px 0; }
.site-footer { padding:24px 0; color:var(--muted); border-top:1px solid var(--border); margin-top:32px; font-size:14px; }
\`;
`);

// Navigation khai báo — sửa ở đây, <Nav/> render + active tự động.
ensure("app/nav.ts", `import type { NavItem } from "@nmvuong92/fluxe/react";

export const nav: NavItem[] = [
  { label: "Trang chủ", href: "/" },
  { label: "Giới thiệu", href: "/about" },
];
`);

// MASTER LAYOUT — header (brand + Nav + ThemeToggle) + main + footer + DebugBar + theme CSS.
ensure("app/layouts/index.tsx", `import type { ReactNode } from "react";
import type { LayoutMeta } from "@nmvuong92/fluxe";
import { Nav, ThemeToggle, Link, DebugBar, shellScript } from "@nmvuong92/fluxe/react";
import { themeCSS } from "../theme";
import { nav } from "../nav";

interface LayoutEntry extends LayoutMeta {
  component: (props: { children: ReactNode }) => ReactNode;
}

export const layouts: Record<string, LayoutEntry> = {
  site: {
    id: "site",
    component: ({ children }) => (
      <>
        <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
        <script dangerouslySetInnerHTML={{ __html: shellScript }} />
        <div className="shell">
          <header className="site-header">
            <Link href="/" className="brand">⚡ fluxe</Link>
            <Nav items={nav} />
            <ThemeToggle />
          </header>
          <main>{children}</main>
          <footer className="site-footer">Dựng bằng fluxe — RCA.</footer>
        </div>
        <DebugBar />
      </>
    ),
  },
};
`);

// Cell home theo cấu trúc tách view/cell (view.tsx = giao diện, index.tsx = route + server).
ensure("app/cells/home/view.tsx", `// GIAO DIỆN thuần.
export interface HomeData {
  title: string;
}

export function Home({ data }: { data: HomeData }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p>Chào mừng tới fluxe — sửa file này để bắt đầu.</p>
    </div>
  );
}

export default Home;
`);

ensure("app/cells/home/index.tsx", `// CELL: route + server logic, gắn view.
import { defineCell } from "@nmvuong92/fluxe";
import { Home, type HomeData } from "./view";

export default defineCell<{}, HomeData>({
  id: "home",
  route: "/",
  layout: "site",        // hydration mặc định "island" — không cần khai báo
  async loader() {
    return { title: "App của tôi" };
  },
  head: (data) => ({ title: data.title }),
  view: Home,
});
`);

ensure("app/cells/about/view.tsx", `export interface AboutData {
  title: string;
}

export function About({ data }: { data: AboutData }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p>Trang giới thiệu — theo theme sáng/tối.</p>
    </div>
  );
}

export default About;
`);

ensure("app/cells/about/index.tsx", `import { defineCell } from "@nmvuong92/fluxe";
import { About, type AboutData } from "./view";

export default defineCell<{}, AboutData>({
  id: "about",
  route: "/about",
  layout: "site",        // hydration mặc định "island"
  async loader() {
    return { title: "Giới thiệu" };
  },
  head: (data) => ({ title: data.title }),
  view: About,
});
`);

console.log("[init] xong. Đăng ký cell:");
execSync("tsx scripts/sync.ts", { stdio: "inherit" });
console.log("→ Chạy: npm run dev   rồi mở  http://localhost:5180");
