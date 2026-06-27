# Contract DSL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho dev khai báo operations (queries/mutations) + types tại `app/contract.ts`; `fx gen` tự sinh types + Zod validators + typed client `api` + server `Resolvers` interface + dispatcher `/__rpc`, DB ẩn sau resolver.

**Architecture:** TS-object schema (`defineContract`) → 4 codegen hàm thuần (string-in/out) → `.fluxe/gen/{types,validators,server,client}.ts`. Runtime `/__rpc/<op>` trong `createHandler` validate Zod + CSRF(mutation) rồi gọi resolver (tiêm qua `{ backend }`). Auto-gen dệt vào `sync`/`fx dev` watch.

**Tech Stack:** TypeScript, node:http, Zod, node:test (`--experimental-sqlite --import tsx`), esbuild.

## Global Constraints

- License header mọi file mới: `// Copyright (c) 2026 nmvuong92` rồi `// SPDX-License-Identifier: Apache-2.0`.
- Engine `src/` KHÔNG import `app/`. Lớp contract là THÊM, behavior-preserving (actions/rpc/withInput cũ giữ nguyên).
- Codegen thuần: string-in / string-out (dễ test, như `genTS` hiện có).
- Type-expr string: scalar `"string"|"int"|"bool"`, ref type `"Todo"`, mảng `"Todo[]"`, optional `"string?"`.
- Mọi tham số tinh chỉnh ENV theo `FLUXE_<FEATURE>_<PARAM>` (feature này không có param runtime mới).
- `npm run test:all` (typecheck + unit + selftest2) phải xanh sau mỗi task.
- TS map: scalar `string→string`, `int→number`, `bool→boolean`.

## File Structure

- `src/core/contract.ts` — `defineContract` + parse type-expr + `genContractTypes`/`genZod`/`genServer`/`genClient`. (Tách khỏi `codegen.ts` cũ vì khác trách nhiệm: codegen.ts = data types; contract.ts = operations.)
- `src/core/contract.test.ts` — unit codegen.
- `src/core/rpc.ts` — `handleRpc(...)` runtime cho `/__rpc/<op>`.
- `src/server_factory.ts` (modify) — gọi `handleRpc` trong `createHandler`; nhận `contract` + `backend`(resolvers).
- `scripts/contract-codegen.ts` — đọc `app/contract.ts` → ghi `.fluxe/gen/*`.
- `scripts/sync.ts` (modify) — chạy contract-codegen sau khi sinh app.ts.
- `src/core/cli.ts` (modify) — `fx dev` watch `app/contract.ts`; `gen` desc.
- `package.json` (modify) — `prepare` hook chạy gen.
- `src/index.ts` (modify) — export `defineContract`, types.
- `app/contract.ts` (modify demo) — thêm queries/mutations.
- `app/backend/index.ts` (create demo) — resolvers.
- `src/adapters/contract.test.ts` hoặc `src/core/rpc.test.ts` — runtime test (boot makeServer + /__rpc).

---

### Task 1: `defineContract` + parse type-expr + `genContractTypes`

**Files:**
- Create: `src/core/contract.ts`
- Test: `src/core/contract.test.ts`

**Interfaces:**
- Produces:
  - `type Scalar = "string" | "int" | "bool"`
  - `interface Contract { types?: Record<string, Record<string, string>>; queries?: Record<string, OpDef>; mutations?: Record<string, OpDef> }`
  - `interface OpDef { in?: Record<string, string>; out: string }`
  - `function defineContract(c: Contract): Contract` (identity + freeze)
  - `function tsType(expr: string): string` — `"Todo[]"`→`"Todo[]"`, `"string?"`→`"string | undefined"`, `"int"`→`"number"`.
  - `function genContractTypes(c: Contract): string` — interface cho mỗi `type` + `<Op>Input` cho op có `in`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/contract.test.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { defineContract, tsType, genContractTypes } from "./contract.ts";

test("tsType: scalar/array/optional/ref", () => {
  assert.equal(tsType("string"), "string");
  assert.equal(tsType("int"), "number");
  assert.equal(tsType("bool"), "boolean");
  assert.equal(tsType("Todo"), "Todo");
  assert.equal(tsType("Todo[]"), "Todo[]");
  assert.equal(tsType("string?"), "string | undefined");
  assert.equal(tsType("Order?"), "Order | undefined");
});

test("genContractTypes: type interfaces + op Input", () => {
  const c = defineContract({
    types: { Todo: { id: "string", title: "string", done: "bool" } },
    mutations: { addTodo: { in: { title: "string" }, out: "Todo" } },
  });
  const out = genContractTypes(c);
  assert.match(out, /export interface Todo \{/);
  assert.match(out, /done: boolean;/);
  assert.match(out, /export interface AddTodoInput \{/);
  assert.match(out, /title: string;/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: FAIL "Cannot find module './contract.ts'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/contract.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract DSL — khai báo nghiệp vụ cell↔backend (queries/mutations + types) bằng TS-object.
 * Codegen thuần string-in/out: types · Zod · server Resolvers · client api. DB ẩn sau resolver. */

export type Scalar = "string" | "int" | "bool";
export interface OpDef { in?: Record<string, string>; out: string }
export interface Contract {
  types?: Record<string, Record<string, string>>;
  queries?: Record<string, OpDef>;
  mutations?: Record<string, OpDef>;
}

export function defineContract(c: Contract): Contract { return c; }

const SCALAR: Record<string, string> = { string: "string", int: "number", bool: "boolean" };

/* Type-expr → TS: hậu tố [] (mảng), ? (optional); scalar map; còn lại = ref type giữ nguyên. */
export function tsType(expr: string): string {
  let e = expr.trim();
  let optional = false;
  if (e.endsWith("?")) { optional = true; e = e.slice(0, -1); }
  let arr = false;
  if (e.endsWith("[]")) { arr = true; e = e.slice(0, -2); }
  let base = SCALAR[e] ?? e;
  if (arr) base = `${base}[]`;
  return optional ? `${base} | undefined` : base;
}

const pascal = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function genObjInterface(name: string, fields: Record<string, string>): string {
  return `export interface ${name} {\n` +
    Object.entries(fields).map(([f, t]) => `  ${f}: ${tsType(t)};`).join("\n") +
    `\n}`;
}

export function genContractTypes(c: Contract): string {
  const out: string[] = [];
  for (const [name, fields] of Object.entries(c.types ?? {})) out.push(genObjInterface(name, fields));
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  for (const [op, def] of Object.entries(ops)) {
    if (def.in) out.push(genObjInterface(`${pascal(op)}Input`, def.in));
  }
  return out.join("\n\n") + "\n";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/contract.ts src/core/contract.test.ts
git commit -m "feat(contract): defineContract + tsType + genContractTypes"
```

---

### Task 2: `genZod` — Zod validator cho input mỗi op

**Files:**
- Modify: `src/core/contract.ts`
- Test: `src/core/contract.test.ts`

**Interfaces:**
- Produces: `function genZod(c: Contract): string` — export `<op>Input` Zod object cho mỗi op có `in`; map scalar→`z.string()/z.number()/z.boolean()`, optional `?`→`.optional()`, mảng `[]`→`z.array(...)`, ref→`z.any()` (v1: ref input chưa nested-validate).

- [ ] **Step 1: Write the failing test**

```ts
// thêm vào src/core/contract.test.ts
import { genZod } from "./contract.ts";

test("genZod: input schema per op", () => {
  const c = defineContract({
    queries: { order: { in: { id: "string" }, out: "Order?" } },
    mutations: { addTodo: { in: { title: "string", qty: "int?" }, out: "Todo" }, ping: { out: "bool" } },
  });
  const out = genZod(c);
  assert.match(out, /import \{ z \} from "zod";/);
  assert.match(out, /export const addTodoInput = z\.object\(\{/);
  assert.match(out, /title: z\.string\(\)/);
  assert.match(out, /qty: z\.number\(\)\.optional\(\)/);
  assert.match(out, /export const orderInput = z\.object/);
  assert.doesNotMatch(out, /pingInput/);   // op không có `in` → không sinh
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: FAIL "genZod is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
// thêm vào src/core/contract.ts
const ZSCALAR: Record<string, string> = { string: "z.string()", int: "z.number()", bool: "z.boolean()" };

function zodExpr(expr: string): string {
  let e = expr.trim();
  let optional = false;
  if (e.endsWith("?")) { optional = true; e = e.slice(0, -1); }
  let arr = false;
  if (e.endsWith("[]")) { arr = true; e = e.slice(0, -2); }
  let z = ZSCALAR[e] ?? "z.any()";   // ref type input: v1 chưa nested-validate
  if (arr) z = `z.array(${z})`;
  return optional ? `${z}.optional()` : z;
}

export function genZod(c: Contract): string {
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  const blocks: string[] = [];
  for (const [op, def] of Object.entries(ops)) {
    if (!def.in) continue;
    const fields = Object.entries(def.in).map(([f, t]) => `  ${f}: ${zodExpr(t)},`).join("\n");
    blocks.push(`export const ${op}Input = z.object({\n${fields}\n});`);
  }
  return `import { z } from "zod";\n\n${blocks.join("\n\n")}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/contract.ts src/core/contract.test.ts
git commit -m "feat(contract): genZod input validators"
```

---

### Task 3: `genServer` — `Resolvers` interface + `createApi`

**Files:**
- Modify: `src/core/contract.ts`
- Test: `src/core/contract.test.ts`

**Interfaces:**
- Produces: `function genServer(c: Contract): string` — sinh:
  - `import type { Todo, ... , <Op>Input } from "./types"`
  - `export interface Resolvers { <op>(input: <In>): Promise<<Out>>; ... }` (op không `in` → `(): Promise<Out>`).
  - `export const OPS = { <op>: "query"|"mutation", ... }` (kind map, dùng runtime).
  - `export function createApi(r: Resolvers): Resolvers { return r; }` (server api = chính resolvers, 0 hop).

- [ ] **Step 1: Write the failing test**

```ts
// thêm vào src/core/contract.test.ts
import { genServer } from "./contract.ts";

test("genServer: Resolvers interface + OPS kind + createApi", () => {
  const c = defineContract({
    types: { Todo: { id: "string" } },
    queries: { todos: { out: "Todo[]" } },
    mutations: { addTodo: { in: { title: "string" }, out: "Todo" } },
  });
  const out = genServer(c);
  assert.match(out, /export interface Resolvers \{/);
  assert.match(out, /todos\(\): Promise<Todo\[\]>;/);
  assert.match(out, /addTodo\(input: AddTodoInput\): Promise<Todo>;/);
  assert.match(out, /todos: "query"/);
  assert.match(out, /addTodo: "mutation"/);
  assert.match(out, /export function createApi/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: FAIL "genServer is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
// thêm vào src/core/contract.ts
function sigOf(op: string, def: OpDef): string {
  const ret = `Promise<${tsType(def.out)}>`;
  return def.in ? `${op}(input: ${pascal(op)}Input): ${ret};` : `${op}(): ${ret};`;
}

export function genServer(c: Contract): string {
  const typeNames = Object.keys(c.types ?? {});
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  const inputNames = Object.entries(ops).filter(([, d]) => d.in).map(([op]) => `${pascal(op)}Input`);
  const imports = [...typeNames, ...inputNames];
  const sigs = Object.entries(ops).map(([op, def]) => `  ${sigOf(op, def)}`).join("\n");
  const kinds = [
    ...Object.keys(c.queries ?? {}).map((op) => `  ${op}: "query",`),
    ...Object.keys(c.mutations ?? {}).map((op) => `  ${op}: "mutation",`),
  ].join("\n");
  return `import type { ${imports.join(", ")} } from "./types";\n\n` +
    `export interface Resolvers {\n${sigs}\n}\n\n` +
    `export const OPS = {\n${kinds}\n} as const;\n\n` +
    `export function createApi(r: Resolvers): Resolvers { return r; }\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/contract.ts src/core/contract.test.ts
git commit -m "feat(contract): genServer Resolvers + OPS + createApi"
```

---

### Task 4: `genClient` — typed `api` qua rpc

**Files:**
- Modify: `src/core/contract.ts`
- Test: `src/core/contract.test.ts`

**Interfaces:**
- Produces: `function genClient(c: Contract): string` — sinh `export const api = { <op>: (input) => rpcCall("<op>", input) }` typed; import types + `rpcCall` từ `@nmvuong92/fluxe/client`.

- [ ] **Step 1: Write the failing test**

```ts
// thêm vào src/core/contract.test.ts
import { genClient } from "./contract.ts";

test("genClient: typed api object", () => {
  const c = defineContract({
    types: { Todo: { id: "string" } },
    queries: { todos: { out: "Todo[]" } },
    mutations: { addTodo: { in: { title: "string" }, out: "Todo" } },
  });
  const out = genClient(c);
  assert.match(out, /import \{ rpcCall \} from "@nmvuong92\/fluxe\/client";/);
  assert.match(out, /todos: \(\): Promise<Todo\[\]> => rpcCall\("todos"\)/);
  assert.match(out, /addTodo: \(input: AddTodoInput\): Promise<Todo> => rpcCall\("addTodo", input\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: FAIL "genClient is not a function".

- [ ] **Step 3: Write minimal implementation**

```ts
// thêm vào src/core/contract.ts
export function genClient(c: Contract): string {
  const typeNames = Object.keys(c.types ?? {});
  const ops = { ...(c.queries ?? {}), ...(c.mutations ?? {}) };
  const inputNames = Object.entries(ops).filter(([, d]) => d.in).map(([op]) => `${pascal(op)}Input`);
  const imports = [...typeNames, ...inputNames];
  const lines = Object.entries(ops).map(([op, def]) => {
    const ret = `Promise<${tsType(def.out)}>`;
    return def.in
      ? `  ${op}: (input: ${pascal(op)}Input): ${ret} => rpcCall("${op}", input),`
      : `  ${op}: (): ${ret} => rpcCall("${op}"),`;
  }).join("\n");
  const typeImport = imports.length ? `import type { ${imports.join(", ")} } from "./types";\n` : "";
  return `import { rpcCall } from "@nmvuong92/fluxe/client";\n${typeImport}\nexport const api = {\n${lines}\n};\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-sqlite --import tsx --test src/core/contract.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/contract.ts src/core/contract.test.ts
git commit -m "feat(contract): genClient typed api"
```

---

### Task 5: `rpcCall` client + barrel export `defineContract`

**Files:**
- Modify: `src/core/client.ts` (thêm `rpcCall`)
- Modify: `src/index.ts` (export defineContract + types)
- Test: dùng existing client test pattern; thêm assert nhẹ trong contract.test (đã cover gen). `rpcCall` test ở runtime task 7.

**Interfaces:**
- Consumes: `rpc(cell, action, input)` đã có trong client.ts (POST `/__action/<cell>/<action>`).
- Produces: `export async function rpcCall<O>(op: string, input?: unknown): Promise<O>` — POST `/__rpc/<op>` với CSRF header (như `rpc`), trả JSON.

- [ ] **Step 1: Write rpcCall (mirror `rpc`)**

Đọc `src/core/client.ts` hàm `rpc` để copy đúng header (csrf, content-type) + error parse. Thêm:

```ts
// src/core/client.ts — thêm gần rpc()
export async function rpcCall<O = any>(op: string, input?: unknown): Promise<O> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-csrf-token": cookie("csrf") };
  if (_chaos) headers["x-fluxe-chaos"] = _chaos;
  const res = await fetch(`/__rpc/${op}`, { method: "POST", headers, body: JSON.stringify(input ?? {}) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw parseRpcError(res.status, body);
  return body as O;
}
```
(Nếu tên helper khác — `parseRpcError`/`cookie`/`_chaos` — dùng đúng tên trong client.ts.)

- [ ] **Step 2: Barrel export**

```ts
// src/index.ts — thêm sau core/codegen
export * from "./core/contract.ts";    // defineContract, Contract, OpDef, tsType, gen*
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: 0 error.

- [ ] **Step 4: Commit**

```bash
git add src/core/client.ts src/index.ts
git commit -m "feat(contract): rpcCall client + barrel export defineContract"
```

---

### Task 6: Runtime `/__rpc/<op>` trong createHandler

**Files:**
- Create: `src/core/rpc.ts`
- Modify: `src/server_factory.ts` (gọi handleRpc; nhận `contract` qua opts)
- Test: `src/core/rpc.test.ts`

**Interfaces:**
- Consumes: `validateInput(schema, raw)` (validate.ts); `FluxeError`; resolvers = `opts.backend`.
- Produces: `handleRpc(args): Promise<boolean>` — nếu path khớp `/__rpc/` thì xử lý (trả true), else false. Args: `{ url, req, res, cookies, backend, contract, validators, readBody }`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/rpc.test.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { makeServer } from "../server_factory.ts";
import { resolve } from "./resolver.ts";
import { defineContract } from "./contract.ts";
import { z } from "zod";

const contract = defineContract({
  queries: { todos: { out: "string[]" } },
  mutations: { addTodo: { in: { title: "string" }, out: "string" } },
});
const validators = { addTodo: z.object({ title: z.string().min(1) }) };
const backend = {
  async todos() { return ["a", "b"]; },
  async addTodo({ title }: { title: string }) { return "[added] " + title; },
};

function req(port: number, path: string, body: any, headers: any = {}): Promise<{ status: number; body: string }> {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data), ...headers } }, (rr) => {
      let b = ""; rr.on("data", (c) => (b += c)); rr.on("end", () => res({ status: rr.statusCode!, body: b }));
    });
    r.on("error", rej); r.write(data); r.end();
  });
}

test("[rpc] query không cần CSRF → output", async () => {
  const m = resolve([], { name: "t" });
  const srv = makeServer(m, [], {}, { backend, contract, validators }).listen(0);
  await new Promise((r) => srv.once("listening", r));
  const port = (srv.address() as any).port;
  try {
    const r = await req(port, "/__rpc/todos", {});
    assert.equal(r.status, 200);
    assert.deepEqual(JSON.parse(r.body), ["a", "b"]);
  } finally { srv.close(); }
});

test("[rpc] mutation thiếu CSRF → 403; input sai → 400; ok → output", async () => {
  const m = resolve([], { name: "t" });
  const srv = makeServer(m, [], {}, { backend, contract, validators }).listen(0);
  await new Promise((r) => srv.once("listening", r));
  const port = (srv.address() as any).port;
  try {
    const noCsrf = await req(port, "/__rpc/addTodo", { title: "x" });
    assert.equal(noCsrf.status, 403);
    const csrf = { cookie: "csrf=tok", "x-csrf-token": "tok" };
    const bad = await req(port, "/__rpc/addTodo", { title: "" }, csrf);
    assert.equal(bad.status, 400);
    const ok = await req(port, "/__rpc/addTodo", { title: "milk" }, csrf);
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.body), "[added] milk");
  } finally { srv.close(); }
});

test("[rpc] op lạ → 404", async () => {
  const m = resolve([], { name: "t" });
  const srv = makeServer(m, [], {}, { backend, contract, validators }).listen(0);
  await new Promise((r) => srv.once("listening", r));
  const port = (srv.address() as any).port;
  try {
    const r = await req(port, "/__rpc/nope", {});
    assert.equal(r.status, 404);
  } finally { srv.close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-sqlite --import tsx --test src/core/rpc.test.ts`
Expected: FAIL (makeServer chưa nhận `contract`/`validators`; /__rpc 404 cho tất cả).

- [ ] **Step 3: Write `src/core/rpc.ts`**

```ts
// src/core/rpc.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type http from "node:http";
import type { ZodType } from "zod";
import { FluxeError } from "./errors.ts";
import { validateInput } from "./validate.ts";
import type { Contract } from "./contract.ts";

export interface RpcArgs {
  url: URL;
  req: http.IncomingMessage;
  res: http.ServerResponse;
  cookies: Record<string, string>;
  backend: any;                       // resolvers
  contract?: Contract;
  validators?: Record<string, ZodType<any>>;
  readBody: (req: http.IncomingMessage) => Promise<string>;
}

/* Trả true nếu đã xử lý (/__rpc/<op>), false nếu không phải route rpc.
 * query → đọc thuần (không CSRF); mutation → CSRF double-submit. */
export async function handleRpc(a: RpcArgs): Promise<boolean> {
  if (!a.url.pathname.startsWith("/__rpc/")) return false;
  const op = decodeURIComponent(a.url.pathname.slice("/__rpc/".length));
  const queries = a.contract?.queries ?? {};
  const mutations = a.contract?.mutations ?? {};
  const isQuery = op in queries;
  const isMutation = op in mutations;
  if (!isQuery && !isMutation) { a.res.writeHead(404); a.res.end("no op"); return true; }

  if (isMutation && (!a.cookies.csrf || a.req.headers["x-csrf-token"] !== a.cookies.csrf)) {
    throw new FluxeError("csrf", "CSRF token không hợp lệ", 403);
  }
  let input = JSON.parse((await a.readBody(a.req)) || "{}");
  const schema = a.validators?.[op];
  if (schema) input = validateInput(schema, input);
  const fn = a.backend?.[op];
  if (typeof fn !== "function") throw new FluxeError("no_resolver", `Resolver thiếu cho '${op}'`, 500);
  const out = await fn(input);
  a.res.writeHead(200, { "content-type": "application/json" });
  a.res.end(JSON.stringify(out));
  return true;
}
```

- [ ] **Step 4: Wire vào createHandler (server_factory.ts)**

Thêm `contract` + `validators` vào `MakeServerOpts`:
```ts
export interface MakeServerOpts { i18n?: I18n; storage?: Storage; config?: FluxeConfig; backend?: unknown;
  contract?: import("./core/contract.ts").Contract; validators?: Record<string, import("zod").ZodType<any>> }
```
Import `handleRpc`. Trong handler, ĐẶT TRƯỚC nhánh `/__action/` (cùng tầng try/catch để lỗi FluxeError được `sendError` xử):
```ts
import { handleRpc } from "./core/rpc.ts";
// ... trong handler, sau khi parse cookies, trước if "/__action/":
if (await handleRpc({ url, req, res, cookies, backend: opts.backend, contract: opts.contract, validators: opts.validators, readBody })) return;
```
(Đảm bảo `cookies` + `readBody` đã có trong scope tại điểm chèn — xem chỗ action handler dùng `cookies`/`readBody`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `node --experimental-sqlite --import tsx --test src/core/rpc.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Full gate + commit**

```bash
npm run test:all
git add src/core/rpc.ts src/server_factory.ts src/core/rpc.test.ts
git commit -m "feat(contract): runtime /__rpc dispatcher (validate + CSRF mutation)"
```

---

### Task 7: codegen script + auto-gen trong sync + demo + integration

**Files:**
- Create: `scripts/contract-codegen.ts`
- Modify: `scripts/sync.ts` (gọi contract-codegen)
- Modify: `app/contract.ts` (queries/mutations)
- Create: `app/backend/index.ts` (resolvers; re-export từ data.ts hoặc dựng mới)
- Modify: `app/cells/todos/*` để dùng `api` (tùy — giữ tối thiểu; integration test riêng)
- Test: `src/core/contract-gen.test.ts` (codegen script ghi file đúng) — hoặc assert trong contract.test bằng cách gọi gen rồi compile.

**Interfaces:**
- Consumes: `genContractTypes/genZod/genServer/genClient` (Task 1-4); `contract` từ app/contract.ts.
- Produces: `.fluxe/gen/{types,validators,server,client}.ts`.

- [ ] **Step 1: Write contract-codegen script**

```ts
// scripts/contract-codegen.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, mkdirSync } from "node:fs";
import { genContractTypes, genZod, genServer, genClient } from "../src/core/contract";
import { contract } from "../app/contract";

mkdirSync(".fluxe/gen", { recursive: true });
const banner = "// AUTO-GENERATED từ app/contract.ts — đừng sửa tay.\n";
writeFileSync(".fluxe/gen/types.ts", banner + genContractTypes(contract));
writeFileSync(".fluxe/gen/validators.ts", banner + genZod(contract));
writeFileSync(".fluxe/gen/server.ts", banner + genServer(contract));
writeFileSync(".fluxe/gen/client.ts", banner + genClient(contract));
console.log("[contract] .fluxe/gen/{types,validators,server,client}.ts");
```

- [ ] **Step 2: app/contract.ts demo (queries/mutations)**

```ts
// app/contract.ts
import { defineContract } from "@nmvuong92/fluxe";
export const contract = defineContract({
  types: { Todo: { id: "string", title: "string", done: "bool" } },
  queries: { todos: { out: "Todo[]" } },
  mutations: { addTodo: { in: { title: "string" }, out: "Todo" }, toggleTodo: { in: { id: "string" }, out: "Todo[]" } },
});
```

- [ ] **Step 3: app/backend/index.ts resolvers (re-dùng data.ts)**

```ts
// app/backend/index.ts — resolvers (impl contract); DB ẩn trong data.ts
import { backend as store } from "./data";
import type { Resolvers } from "../../.fluxe/gen/server";
export const backend: Resolvers = {
  todos: () => store.listTodos(),
  addTodo: ({ title }) => store.addTodo(title),
  toggleTodo: ({ id }) => store.toggleTodo(id),
};
```

- [ ] **Step 4: Generate + typecheck**

Run: `node --experimental-sqlite --import tsx scripts/contract-codegen.ts && npx tsc --noEmit -p tsconfig.json`
Expected: sinh 4 file; tsc 0 error (Resolvers khớp).

- [ ] **Step 5: Hook auto-gen vào sync.ts**

Cuối `scripts/sync.ts`, sau khi ghi app.ts/views.ts, thêm chạy contract codegen (try/catch để app chưa có contract không vỡ):

```ts
// scripts/sync.ts — cuối file
try {
  const { execSync } = await import("node:child_process");
  execSync("node --experimental-sqlite --import tsx scripts/contract-codegen.ts", { stdio: "inherit" });
} catch (e) { console.warn("[sync] contract codegen bỏ qua:", (e as Error).message); }
```

- [ ] **Step 6: Integration test (api server 0-hop = client kết quả)**

```ts
// src/core/contract-gen.test.ts
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { defineContract, genServer, genClient } from "./contract.ts";

test("[gen] server interface + client api cùng op-set", () => {
  const c = defineContract({ queries: { todos: { out: "string[]" } }, mutations: { addTodo: { in: { title: "string" }, out: "string" } } });
  const s = genServer(c), cl = genClient(c);
  for (const op of ["todos", "addTodo"]) { assert.match(s, new RegExp(op)); assert.match(cl, new RegExp(op)); }
});
```

- [ ] **Step 7: Gate + commit**

```bash
npm run test:all
git add scripts/contract-codegen.ts scripts/sync.ts app/contract.ts app/backend/index.ts src/core/contract-gen.test.ts .gitignore
git commit -m "feat(contract): auto-gen trong sync + demo contract + resolvers"
```

---

### Task 8: Auto-gen magic — `prepare` hook + `fx dev` watch/hot-reload

**Mục tiêu DX (như svelte-kit sync / astro sync):** dev KHÔNG gõ gen tay; editor có type ngay sau
`npm install` (prepare); lưu `app/contract.ts` → regen + reload tự động.

**Files:**
- Modify: `src/core/cli.ts` (gen desc; `dev` thêm `--watch`)
- Modify: `package.json` (`prepare` hook; `dev` script `--watch`)
- Modify: `.gitignore` (đảm bảo `.fluxe/` ignored — kiểm tra, thường đã có)

**Interfaces:** không có symbol mới.

- [ ] **Step 1: cli gen desc**

```ts
// src/core/cli.ts — gen command desc
desc: "Codegen contract → types + Zod + client api + server Resolvers (.fluxe/gen)",
shell: () => `tsx scripts/contract-codegen.ts`,
```

- [ ] **Step 2: `fx dev` watch/hot-reload — re-sync + restart khi app/ đổi**

Sửa `dev` command shell trong cli.ts dùng `tsx --watch` (restart server khi file đổi) + clause
watch chạy sync trước. `tsx --watch` theo dõi import graph; thêm `--include` cho `app/contract.ts`
(không nằm trong import graph runtime của server nếu chỉ gen). Cách chắc chắn: chạy 1 watcher sync
song song. Cập nhật shell:
```ts
// src/core/cli.ts — dev command
shell: (a) => `${SYNC} && tsx scripts/resolve.ts ${p(a)} && ${ESBUILD} && tsx watch --clear-screen=false --include 'app/**' app/backend/server.ts`,
```
Nếu `tsx watch --include` không nhận `app/contract.ts` (chỉ-gen, không import), thêm script watcher
`scripts/dev-watch.ts` dùng `node:fs.watch("app", { recursive: true })` → debounce → chạy `npm run sync`
(sync đã gọi contract-codegen ở Task 7) → `tsx --watch` tự restart server khi `.fluxe/gen/*` đổi.
Giữ đơn giản: nếu `tsx --watch app/backend/server.ts` + sync-on-restart đủ "lưu là reload", dùng nó;
ghi rõ giới hạn (đổi contract cần touch một file trong import graph hoặc chạy `fx sync`).

- [ ] **Step 3: package.json prepare hook + dev watch**

```json
"prepare": "node --experimental-sqlite --import tsx scripts/contract-codegen.ts || true",
"dev": "npm run build:client && node --experimental-sqlite --import tsx --watch app/backend/server.ts",
```
(`|| true`: môi trường không có app/contract vẫn `npm install` được. `--watch`: lưu file → restart.)

- [ ] **Step 4: .gitignore `.fluxe/`**

Kiểm tra `.gitignore` có dòng `.fluxe/` (artifact). Nếu chưa, thêm. `.fluxe/gen/*` KHÔNG commit
(rebuild được — như `.svelte-kit/`).

- [ ] **Step 5: Verify**

Run: `npm install` → kiểm `.fluxe/gen/*` xuất hiện (prepare). Rồi `npm run dev`, sửa `app/contract.ts`
(thêm 1 mutation), lưu → server restart + (sau `fx sync`) `.fluxe/gen/*` cập nhật.
Expected: prepare sinh gen; dev restart khi lưu.

- [ ] **Step 6: Commit**

```bash
git add src/core/cli.ts package.json .gitignore
git commit -m "feat(contract): auto-gen magic — prepare hook + fx dev watch/hot-reload"
```

---

### Task 9: Docs + reframe data.md

**Files:**
- Create: `docs-site/src/content/docs/reference/contract.md`
- Modify: `docs-site/src/content/docs/reference/data.md` (reframe: DB = chi tiết ẩn sau resolver)
- Modify: `docs-site/src/content/docs/guides/features.md` (mục Contract)
- Modify: `docs-site/astro.config.mjs` nếu cần (reference autogenerate → không cần)
- Modify: `CLAUDE.md` (docs-sync row + ranh giới contract)

- [ ] **Step 1: reference/contract.md** — định nghĩa DSL (`defineContract`), bảng 4 artifact, ví dụ `app/contract.ts` + resolver + dùng `api` ở loader (server 0-hop) và view (client rpc), `/__rpc`, CSRF query/mutation, auto-gen. Import từ `@nmvuong92/fluxe`. Copy snippet từ source thật.

- [ ] **Step 2: data.md reframe** — đổi mở đầu: "Backend = nghiệp vụ của bạn sau một CONTRACT; DB chỉ là chi tiết ẩn trong resolver." Bỏ nhấn 'driver' làm khái niệm fluxe; trỏ sang [Contract](/reference/contract/).

- [ ] **Step 3: features.md** — thêm mục "## Contract DSL" snippet `defineContract` + `api`.

- [ ] **Step 4: CLAUDE.md** — docs-sync row: `Thêm/sửa contract DSL/codegen/__rpc | reference/contract.md`. Ranh giới: contract là nguồn sự thật cell↔backend; DB ẩn sau resolver.

- [ ] **Step 5: Build docs + commit**

```bash
cd docs-site && npm run build && cd ..
git add docs-site CLAUDE.md
git commit -m "docs(contract): reference/contract + reframe data.md (DB ẩn) + features + CLAUDE"
```

- [ ] **Step 6: Release minor**

```bash
npm run release:minor   # test:all → npm version minor → push tag → CI publish
```

---

## Self-Review

**Spec coverage:** §1 (contract shape) → Task 1-4; fx gen 4 artifact → Task 1-4 + 7; §2 runtime /__rpc → Task 6; api server/client → Task 3,4,5; CSRF query/mutation → Task 6; resolvers qua {backend} → Task 6; auto-gen sync/watch/prepare → Task 7,8; behavior-preserving → Task 6 (đặt trước /__action, test:all gate); docs + reframe → Task 9. ✔ phủ hết.

**Type consistency:** `Contract`/`OpDef`/`defineContract` (Task 1) dùng nhất quán ở 2-9; `Resolvers`/`createApi`/`OPS` (Task 3) → resolvers `{backend}` (Task 6) + demo (Task 7); `rpcCall` (Task 5) → genClient (Task 4) khớp tên; `handleRpc(RpcArgs)` (Task 6) khớp opts `contract`/`validators`. ✔

**Placeholder scan:** mọi step có code thật; điểm cần kiểm khi code: tên helper trong `client.ts` (`parseRpcError`/`cookie`/`_chaos`) phải khớp source thật (Task 5 Step 1 ghi rõ "dùng đúng tên"). Điểm chèn `handleRpc` cần `cookies`+`readBody` trong scope (Task 6 Step 4 nêu rõ). ✔
