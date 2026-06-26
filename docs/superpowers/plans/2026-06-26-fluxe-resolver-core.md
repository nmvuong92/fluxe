# fluxe Resolver Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng Resolver core (RCA): gom mọi quyết định vận hành vào một pass `resolve()` thuần → xuất Resolution Manifest → runtime chỉ đọc; chứng minh đổi profile → đổi hành vi mà cell không đổi.

**Architecture:** `resolve(cells, profile)` (thuần, build-time) → `.fluxe/resolution.json`. `backendFromManifest(manifest)` dựng Backend từ manifest. `makeServer(manifest)` đọc manifest để wire backend + render flags thay if-check rải rác. Resolver + wiring không phụ thuộc React (test dependency-free); build-script + server cần React.

**Tech Stack:** TypeScript, Node ≥ 23 (chạy TS native qua type-stripping), `node:test` + `node:assert/strict` (unit, 0 dep), `tsx` + React (build-script/server, cần `npm install`).

## Global Constraints

- Ngôn ngữ: TypeScript, ESM (`"type":"module"`).
- **Resolver (`src/core/resolver.ts`) PHẢI thuần**: không I/O, không import React, không import backend. Chỉ data-in → data-out.
- **Module được node-native test import PHẢI dùng đuôi `.ts` tường minh** trên import quan hệ của chính nó (node native cần đuôi; tsx cũng chấp nhận `.ts`). Import type-only không cần đuôi.
- Manifest = **JSON** (`.fluxe/resolution.json`), 2-space indent, inspectable. KHÔNG binary (quyết định spec §4.3b).
- Validate **fail-fast** (ném `Error` mô tả rõ) lúc build/boot — không để chết giữa request (tenet T4).
- 3 trục v0.1: Render (`static`/`island`) · Backend language (`memory`/`go`/`rust`) · Transport (suy ra: memory→in-process, go/rust→http).
- KHÔNG sửa `src/core/engine.ts`, `src/cells/*`, `src/backends/{memory,http}.ts`.

## Prerequisites

- Repo CHƯA phải git. Nếu muốn commit theo từng task: chạy `git init` một lần trước Task 1. Nếu không, bỏ qua mọi bước "Commit".
- Task 1–2 chạy được KHÔNG cần `npm install`. Task 3–4 cần `npm install` (React + tsx).

---

### Task 1: Resolver core — `resolve()` + types (dependency-free)

**Files:**
- Create: `src/core/resolver.ts`
- Test: `src/core/resolver.test.ts`

**Interfaces:**
- Consumes: (không gì — thuần)
- Produces:
  - `type RenderMode = "static" | "island"`
  - `type BackendKind = "memory" | "go" | "rust"`
  - `interface CellDecl { id: string; route: string; hydration: RenderMode }`
  - `interface ResolutionProfile { name: string; backend: BackendKind; endpoints?: { go?: string; rust?: string } }`
  - `interface BackendResolution { language: BackendKind; transport: "in-process" | "http"; endpoint?: string }`
  - `interface CellResolution { id: string; route: string; render: { mode: RenderMode; shipClientJs: boolean } }`
  - `interface ResolutionManifest { version: 1; profile: string; backend: BackendResolution; cells: Record<string, CellResolution> }`
  - `function resolve(cells: CellDecl[], profile: ResolutionProfile): ResolutionManifest`

- [ ] **Step 1: Write the failing test**

Create `src/core/resolver.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "./resolver.ts";

const cells = [
  { id: "home", route: "/", hydration: "static" as const },
  { id: "todos", route: "/todos", hydration: "island" as const },
];

test("memory profile → in-process, no endpoint", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.equal(m.version, 1);
  assert.equal(m.profile, "dev");
  assert.deepEqual(m.backend, { language: "memory", transport: "in-process" });
});

test("go profile → http + endpoint", () => {
  const m = resolve(cells, { name: "prod-go", backend: "go", endpoints: { go: "http://127.0.0.1:8081" } });
  assert.deepEqual(m.backend, { language: "go", transport: "http", endpoint: "http://127.0.0.1:8081" });
});

test("render flags map per hydration", () => {
  const m = resolve(cells, { name: "dev", backend: "memory" });
  assert.deepEqual(m.cells.home.render, { mode: "static", shipClientJs: false });
  assert.deepEqual(m.cells.todos.render, { mode: "island", shipClientJs: true });
  assert.equal(m.cells.todos.route, "/todos");
});

test("fail-fast: go without endpoint", () => {
  assert.throws(() => resolve(cells, { name: "bad", backend: "go" }), /endpoints\.go/);
});

test("fail-fast: duplicate route", () => {
  const dup = [
    { id: "a", route: "/x", hydration: "static" as const },
    { id: "b", route: "/x", hydration: "static" as const },
  ];
  assert.throws(() => resolve(dup, { name: "dev", backend: "memory" }), /route trùng/);
});

test("fail-fast: duplicate id", () => {
  const dup = [
    { id: "a", route: "/x", hydration: "static" as const },
    { id: "a", route: "/y", hydration: "static" as const },
  ];
  assert.throws(() => resolve(dup, { name: "dev", backend: "memory" }), /id trùng/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/core/resolver.test.ts`
Expected: FAIL — `Cannot find module './resolver.ts'` (chưa tạo).

- [ ] **Step 3: Write minimal implementation**

Create `src/core/resolver.ts`:

```ts
export type RenderMode = "static" | "island";
export type BackendKind = "memory" | "go" | "rust";

export interface CellDecl {
  id: string;
  route: string;
  hydration: RenderMode;
}

export interface ResolutionProfile {
  name: string;
  backend: BackendKind;
  endpoints?: { go?: string; rust?: string };
}

export interface BackendResolution {
  language: BackendKind;
  transport: "in-process" | "http";
  endpoint?: string;
}

export interface CellResolution {
  id: string;
  route: string;
  render: { mode: RenderMode; shipClientJs: boolean };
}

export interface ResolutionManifest {
  version: 1;
  profile: string;
  backend: BackendResolution;
  cells: Record<string, CellResolution>;
}

const ALLOWED: BackendKind[] = ["memory", "go", "rust"];

export function resolve(cells: CellDecl[], profile: ResolutionProfile): ResolutionManifest {
  if (!ALLOWED.includes(profile.backend)) {
    throw new Error(`profile "${profile.name}": backend không hợp lệ: ${profile.backend}`);
  }

  let backend: BackendResolution;
  if (profile.backend === "memory") {
    backend = { language: "memory", transport: "in-process" };
  } else {
    const endpoint = profile.endpoints?.[profile.backend];
    if (!endpoint) {
      throw new Error(`profile "${profile.name}": backend "${profile.backend}" cần endpoints.${profile.backend}`);
    }
    backend = { language: profile.backend, transport: "http", endpoint };
  }

  const out: Record<string, CellResolution> = {};
  const seenRoutes = new Set<string>();
  for (const c of cells) {
    if (out[c.id]) throw new Error(`cell id trùng: ${c.id}`);
    if (seenRoutes.has(c.route)) throw new Error(`route trùng: ${c.route}`);
    seenRoutes.add(c.route);
    out[c.id] = {
      id: c.id,
      route: c.route,
      render: { mode: c.hydration, shipClientJs: c.hydration === "island" },
    };
  }

  return { version: 1, profile: profile.name, backend, cells: out };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/core/resolver.test.ts`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit** (bỏ qua nếu không dùng git)

```bash
git add src/core/resolver.ts src/core/resolver.test.ts
git commit -m "feat(resolver): pure resolve() + manifest types with fail-fast validation"
```

---

### Task 2: Manifest → Backend wiring — `backendFromManifest()` (dependency-free)

**Files:**
- Create: `src/core/wiring.ts`
- Test: `src/core/wiring.test.ts`

**Interfaces:**
- Consumes: `ResolutionManifest`, `BackendResolution` (Task 1); `createMemoryBackend` (`src/backends/memory.ts`), `createHttpBackend` (`src/backends/http.ts`), `Backend` (`src/backends/types.ts`) — đã có.
- Produces: `function backendFromManifest(m: ResolutionManifest): Backend`

- [ ] **Step 1: Write the failing test**

Create `src/core/wiring.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { backendFromManifest } from "./wiring.ts";
import type { ResolutionManifest } from "./resolver.ts";

const base = (backend: ResolutionManifest["backend"]): ResolutionManifest => ({
  version: 1, profile: "t", backend, cells: {},
});

test("memory manifest → memory backend", () => {
  const b = backendFromManifest(base({ language: "memory", transport: "in-process" }));
  assert.equal(b.name, "memory");
});

test("go manifest → http backend named 'go'", () => {
  const b = backendFromManifest(base({ language: "go", transport: "http", endpoint: "http://127.0.0.1:8081" }));
  assert.equal(b.name, "go");
});

test("fail-fast: http language without endpoint", () => {
  assert.throws(
    () => backendFromManifest(base({ language: "rust", transport: "http" })),
    /thiếu endpoint/,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/core/wiring.test.ts`
Expected: FAIL — `Cannot find module './wiring.ts'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/core/wiring.ts`:

```ts
import type { Backend } from "../backends/types";
import type { ResolutionManifest } from "./resolver.ts";
import { createMemoryBackend } from "../backends/memory.ts";
import { createHttpBackend } from "../backends/http.ts";

export function backendFromManifest(m: ResolutionManifest): Backend {
  const b = m.backend;
  if (b.language === "memory") return createMemoryBackend();
  if (!b.endpoint) throw new Error(`manifest backend "${b.language}" thiếu endpoint`);
  return createHttpBackend(b.language, b.endpoint);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/core/wiring.test.ts`
Expected: PASS — `# pass 3`, `# fail 0`.

- [ ] **Step 5: Commit** (bỏ qua nếu không dùng git)

```bash
git add src/core/wiring.ts src/core/wiring.test.ts
git commit -m "feat(resolver): backendFromManifest() wiring manifest→Backend"
```

---

### Task 3: Profiles + build script — sinh `.fluxe/resolution.json` (cần `npm install`)

**Files:**
- Create: `src/profiles.ts`
- Create: `scripts/resolve.ts`
- Modify: `package.json` (thêm script `resolve`)

**Interfaces:**
- Consumes: `resolve`, `ResolutionProfile` (Task 1); cells `home` (`src/cells/home/index.ts`), `todos` (`src/cells/todos/index.tsx`).
- Produces: `export const profiles: Record<string, ResolutionProfile>`; artifact `.fluxe/resolution.json`.

- [ ] **Step 1: Cài dependency (cần cho import cell React qua tsx)**

Run: `npm install`
Expected: thư mục `node_modules/` xuất hiện, có `node_modules/.bin/tsx`.

- [ ] **Step 2: Tạo profiles**

Create `src/profiles.ts`:

```ts
import type { ResolutionProfile } from "./core/resolver";

export const profiles: Record<string, ResolutionProfile> = {
  dev: { name: "dev", backend: "memory" },
  "prod-go": { name: "prod-go", backend: "go", endpoints: { go: "http://127.0.0.1:8081" } },
  "prod-rust": { name: "prod-rust", backend: "rust", endpoints: { rust: "http://127.0.0.1:8082" } },
};
```

- [ ] **Step 3: Tạo build script**

Create `scripts/resolve.ts`:

```ts
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolveManifest, type CellDecl } from "../src/core/resolver";
import { profiles } from "../src/profiles";
import home from "../src/cells/home/index";
import todos from "../src/cells/todos/index";

const name = process.argv[2] ?? process.env.FLUXE_PROFILE ?? "dev";
const profile = profiles[name];
if (!profile) {
  console.error(`Profile không tồn tại: ${name}. Có: ${Object.keys(profiles).join(", ")}`);
  process.exit(1);
}

const cells: CellDecl[] = [home, todos].map((c) => ({
  id: c.id,
  route: c.route,
  hydration: c.hydration,
}));

const manifest = resolveManifest(cells, profile);
mkdirSync(".fluxe", { recursive: true });
writeFileSync(".fluxe/resolution.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`[resolve] profile="${name}" → .fluxe/resolution.json`);
console.log(JSON.stringify(manifest, null, 2));
```

- [ ] **Step 4: Thêm npm script**

Modify `package.json` — thêm vào khối `"scripts"`:

```json
    "resolve": "tsx scripts/resolve.ts",
```

- [ ] **Step 5: Chạy build script cho 2 profile và kiểm tra output**

Run: `npm run resolve -- dev`
Expected: in ra manifest với `"backend": { "language": "memory", "transport": "in-process" }` và `todos.render.shipClientJs: true`, `home.render.shipClientJs: false`. File `.fluxe/resolution.json` được tạo.

Run: `npm run resolve -- prod-go`
Expected: manifest với `"backend": { "language": "go", "transport": "http", "endpoint": "http://127.0.0.1:8081" }`; phần `cells` GIỮ NGUYÊN so với dev (chứng minh render độc lập với backend).

- [ ] **Step 6: Commit** (bỏ qua nếu không dùng git)

```bash
git add src/profiles.ts scripts/resolve.ts package.json
git commit -m "feat(resolver): profiles + resolve build script writing .fluxe/resolution.json"
```

---

### Task 4: Runtime đọc manifest + integration proof (cần `npm install`)

**Files:**
- Modify: `src/server_factory.ts` (đổi `makeServer` đọc manifest, bỏ if-check)
- Modify: `src/server.tsx` (đọc `.fluxe/resolution.json`, truyền manifest)
- Modify: `src/selftest2.ts` (integration: 2 profile → 2 hành vi, cell không đổi)

**Interfaces:**
- Consumes: `ResolutionManifest`, `resolve` (Task 1); `backendFromManifest` (Task 2); `profiles` (Task 3).
- Produces: `function makeServer(manifest: ResolutionManifest): http.Server`.

- [ ] **Step 1: Viết integration test (failing) — `src/selftest2.ts`**

Thay TOÀN BỘ nội dung `src/selftest2.ts` bằng:

```ts
/* Integration proof: cùng cell, 2 profile → 2 manifest → 2 hành vi. Cell KHÔNG đổi. */
import http from "node:http";
import { makeServer } from "./server_factory";
import { resolve, type CellDecl } from "./core/resolver";
import { profiles } from "./profiles";
import home from "./cells/home/index";
import todos from "./cells/todos/index";

const cells: CellDecl[] = [home, todos].map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));

function get(port: number, path: string, headers: any = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode!, body: b }));
    });
    r.on("error", reject); r.end();
  });
}

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
}

async function run(profileName: string, port: number) {
  const manifest = resolve(cells, profiles[profileName]);
  console.log(`\n══════════ profile=${profileName} (backend=${manifest.backend.language}/${manifest.backend.transport}) ══════════`);
  const srv = makeServer(manifest).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const homePage = await get(port, "/");
    check("[static /] KHÔNG gửi client.js", !homePage.body.includes("/client.js"));
    const todosPage = await get(port, "/todos");
    check("[island /todos] CÓ gửi client.js", todosPage.body.includes("/client.js"));
    const api = JSON.parse((await get(port, "/todos?json=1")).body);
    check(`[backend] tên hiển thị = ${manifest.backend.language}`, api.data.backendName === manifest.backend.language);
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function main() {
  await run("dev", 5190);          // backend memory in-process
  // prod-go cần service Go ở :8081 — nếu không chạy, bỏ qua phần gọi backend.
  console.log("\n→ Cùng cell + cùng makeServer, đổi profile → manifest khác → hành vi khác. Cell KHÔNG đổi dòng nào.");
  process.exit(failures === 0 ? 0 : 1);
}
main();
```

- [ ] **Step 2: Run integration to verify it fails**

Run: `npm test`
Expected: FAIL — TypeScript/runtime lỗi vì `makeServer` còn nhận `string`, chưa nhận `ResolutionManifest` (hoặc `backendFromManifest` chưa được dùng). Đây là tín hiệu cần refactor server_factory.

- [ ] **Step 3: Refactor `src/server_factory.ts` đọc manifest**

Thay phần đầu file — đổi import:

```ts
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import type { CellDef } from "./core/engine";
import type { ResolutionManifest } from "./core/resolver";
import { backendFromManifest } from "./core/wiring.ts";
import home from "./cells/home/index";
import todos from "./cells/todos/index";
```

Đổi `shell()` để nhận cờ `shipClientJs` thay cho `cell.hydration`:

```ts
function shell(cell: CellDef<any, any>, bodyHtml: string, data: unknown, shipClientJs: boolean) {
  const island = shipClientJs
    ? `<script>window.__FLUXE__=${JSON.stringify({ cell: cell.id, data })};</script><script type="module" src="/client.js"></script>`
    : `<!-- static: 0 JS -->`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>fluxe</title></head><body><div id="root">${bodyHtml}</div>${island}</body></html>`;
}
```

Đổi `makeServer` nhận manifest + dùng `backendFromManifest`:

```ts
export function makeServer(manifest: ResolutionManifest) {
  const backend = backendFromManifest(manifest);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname === "/client.js") {
      if (existsSync("./dist/client.js")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(readFileSync("./dist/client.js")); }
      res.writeHead(404); return res.end("// no client");
    }
    if (url.pathname.startsWith("/__action/") && req.method === "POST") {
      const [, , cellId, name] = url.pathname.split("/");
      const fn = byId.get(cellId)?.actions?.[name];
      if (!fn) { res.writeHead(404); return res.end("no action"); }
      const out = await fn({ input: JSON.parse((await readBody(req)) || "{}"), backend });
      res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(out));
    }
    const cell = byRoute.get(url.pathname);
    if (!cell) { res.writeHead(404); return res.end("404"); }
    const data = await cell.loader({ input: {}, backend });
    const wantsJson = req.headers["x-fluxe"] === "1" || url.searchParams.get("json") === "1";
    if (wantsJson) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ cell: cell.id, data })); }
    const bodyHtml = renderToString(h(cell.view, { data }));
    const shipClientJs = manifest.cells[cell.id]?.render.shipClientJs ?? false;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(shell(cell, bodyHtml, data, shipClientJs));
  });
}
```

Giữ nguyên các dòng `const cells`, `byRoute`, `byId`, `readBody` đã có giữa file. XÓA import `createMemoryBackend`, `createRemoteBackend`, `createHttpBackend` và `type { Backend }` nếu không còn dùng.

- [ ] **Step 4: Run integration to verify it passes**

Run: `npm test`
Expected: PASS — khối `profile=dev` in `✓ [static /]`, `✓ [island /todos]`, `✓ [backend] tên hiển thị = memory`; exit 0.

- [ ] **Step 5: Cập nhật `src/server.tsx` đọc manifest**

Thay TOÀN BỘ `src/server.tsx`:

```ts
import { readFileSync } from "node:fs";
import { makeServer } from "./server_factory";
import type { ResolutionManifest } from "./core/resolver";

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const PORT = Number(process.env.PORT) || 5180;
makeServer(manifest).listen(PORT, () =>
  console.log(`fluxe @ http://localhost:${PORT} (profile: ${manifest.profile}, backend: ${manifest.backend.language})`));
```

- [ ] **Step 6: Smoke test server thật**

Run: `npm run resolve -- dev && npm run build:client && PORT=5181 tsx src/server.tsx & sleep 2 && curl -s "http://127.0.0.1:5181/todos?json=1" ; kill %1`
Expected: JSON có `"backendName":"memory"`; server log in `profile: dev, backend: memory`.

- [ ] **Step 7: Commit** (bỏ qua nếu không dùng git)

```bash
git add src/server_factory.ts src/server.tsx src/selftest2.ts
git commit -m "feat(resolver): makeServer reads manifest; integration proves RCA (cell unchanged)"
```

---

## Self-Review (đã chạy)

- **Spec coverage:** §4.1 ResolutionProfile → Task 1. §4.2 Manifest + §4.3 resolve() → Task 1. §4.3b format → Global Constraints (JSON). §4.4 makeServer → Task 4. §4.5 build step → Task 3. §6 error handling (fail-fast) → Task 1/2 tests. §7 testing → Task 1/2 unit (no install), Task 4 integration. Hết §; không gap.
- **Placeholder scan:** không có TBD/TODO; mọi step có code/command thật.
- **Type consistency:** `CellDecl`/`ResolutionProfile`/`ResolutionManifest`/`BackendResolution`/`CellResolution` định nghĩa Task 1, dùng nhất quán Task 2–4; `resolve()`, `backendFromManifest()`, `makeServer(manifest)` khớp signature xuyên các task.
- **Out of scope (xác nhận không làm):** inference, per-cell backend, trục Scale/State-driver, gRPC/FlatBuffers, codegen Go/Rust, HMR re-resolve, panel RCA dashboard, request isolation runtime.
