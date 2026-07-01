// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Integration proof: cùng cell, đổi manifest/backend → hành vi khác. Cell KHÔNG đổi.
 * Chạy trên starter tối thiểu (home/greet static + todos island + contract todos). */
import http from "node:http";
import { makeServer } from "./server_factory";
import { resolve, type CellDecl } from "./core/resolver";
import { profiles } from "../app/frontend/profiles";
import { cells as appCells } from "../app/frontend/registry";
import { layouts } from "../app/frontend/layouts/index";
import { i18n } from "../app/frontend/i18n";
import { contract } from "../app/backend/contract";
import { makeDb } from "../app/backend/db";
import { makeTodosResolvers } from "../app/backend/modules/todos/api/resolver";

const decls: CellDecl[] = appCells.map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));

function get(port: number, path: string, headers: any = {}): Promise<{ status: number; body: string; headers: any }> {
  return new Promise((res, rej) => {
    const r = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (rs) => {
      let b = ""; rs.on("data", (c) => (b += c)); rs.on("end", () => res({ status: rs.statusCode!, body: b, headers: rs.headers }));
    });
    r.on("error", rej); r.end();
  });
}

function post(port: number, path: string, body: any, headers: any = {}): Promise<{ status: number; body: string; headers: any }> {
  return new Promise((res, rej) => {
    const data = JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data), ...headers } }, (rs) => {
      let b = ""; rs.on("data", (c) => (b += c)); rs.on("end", () => res({ status: rs.statusCode!, body: b, headers: rs.headers }));
    });
    r.on("error", rej); r.write(data); r.end();
  });
}

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
}

async function run(profileName: string, port: number) {
  const store = makeDb();
  const resolvers = makeTodosResolvers(store);
  const manifest = resolve(decls, profiles[profileName]);
  console.log(`\n══════════ profile=${profileName} (backend=${store.name}) ══════════`);
  const srv = makeServer(manifest, appCells, layouts, { backend: store, resolvers, contract, i18n }).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const greetPage = await get(port, "/greet");
    check("[static /greet] KHÔNG gửi client.js", !greetPage.body.includes("/client.js"));
    const todosPage = await get(port, "/todos");
    check("[island /todos] CÓ gửi client.js", todosPage.body.includes("/client.js"));

    // Contract DSL: /__rpc/<op> từ contract thật + resolvers (DB ẩn). Validate Zod.
    const rpcList = await post(port, "/__rpc/listTodos", {});
    check("[contract] /__rpc/listTodos (query) → mảng", rpcList.status === 200 && Array.isArray(JSON.parse(rpcList.body)));
    const rpcBad = await post(port, "/__rpc/addTodo", { title: 123 });
    check("[contract] /__rpc/addTodo title sai kiểu → 400 (Zod)", rpcBad.status === 400);
    const rpcAdd = await post(port, "/__rpc/addTodo", { title: "việc hợp lệ" });
    check("[contract] /__rpc/addTodo hợp lệ → 200 + tạo todo", rpcAdd.status === 200 && JSON.parse(rpcAdd.body).title === "việc hợp lệ");
    const rpcList2 = JSON.parse((await post(port, "/__rpc/listTodos", {})).body);
    check("[contract] listTodos thấy todo vừa thêm", rpcList2.some((t: any) => t.title === "việc hợp lệ"));

    // Realtime SSE: subscribe topic onTodos, addTodo publish → nhận event live.
    const sseEvents: string[] = [];
    const sseReq = http.request({ host: "127.0.0.1", port, path: "/__sse/onTodos", method: "GET" }, (res) => res.on("data", (c) => sseEvents.push(c.toString())));
    sseReq.end();
    await new Promise((r) => setTimeout(r, 100));
    await post(port, "/__rpc/addTodo", { title: "todo realtime" });
    await new Promise((r) => setTimeout(r, 120));
    check("[sse] subscription onTodos nhận event sau addTodo", sseEvents.join("").includes("todo realtime"));
    sseReq.destroy();

    // Render cache: ETag → If-None-Match khớp → 304.
    const apiRes = await get(port, "/todos?json=1");
    const etag = apiRes.headers.etag;
    const notMod = await get(port, "/todos?json=1", { "if-none-match": etag });
    check("[cache] JSON props ETag + If-None-Match → 304", typeof etag === "string" && notMod.status === 304 && notMod.body === "");

    // Observability + dashboard.
    const panel = await get(port, "/_fluxe");
    check("[/_fluxe] dashboard: RCA Resolution + cell todos", panel.status === 200 && panel.body.includes("RCA Resolution") && panel.body.includes("todos"));
    await get(port, "/todos");
    const logs = JSON.parse((await get(port, "/_fluxe/requests")).body);
    check("[observe] /_fluxe/requests log request (/todos + status + ms)",
      Array.isArray(logs) && logs.some((e: any) => e.path === "/todos" && typeof e.status === "number" && typeof e.ms === "number"));

    // Routing + SEO + i18n.
    check("[route] no-match → 404", (await get(port, "/nope/x")).status === 404);
    const homeHtml = (await get(port, "/")).body;
    check("[SEO] home <title> từ i18n loader", homeHtml.includes("<title>fluxe starter</title>"));
    const sm = await get(port, "/sitemap.xml");
    check("[SEO] /sitemap.xml có /todos", sm.status === 200 && sm.body.includes("/todos</loc>"));
    const rb = await get(port, "/robots.txt");
    check("[SEO] /robots.txt trỏ sitemap", rb.status === 200 && rb.body.includes("Sitemap:"));
    const greetEn = await get(port, "/greet", { "accept-language": "en" });
    check("[i18n] Accept-Language: en → dịch tiếng Anh", greetEn.body.includes("Hello, fluxe!"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

// Đối chứng: manifest có quyền TỐI CAO trên cell.hydration (ép greet static → ship JS).
async function runOverride(port: number) {
  const store = makeDb();
  const manifest = resolve(decls, profiles.dev);
  manifest.cells.greet.render.shipClientJs = true;
  console.log(`\n══════════ override: manifest ép greet ship JS ══════════`);
  const srv = makeServer(manifest, appCells, layouts, { backend: store, i18n }).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const greetPage = await get(port, "/greet");
    check("[override] greet (static) GỬI client.js vì manifest ép → manifest > cell.hydration", greetPage.body.includes("/client.js"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

// Đối chứng: backend USER-OWNED inject qua opts.backend → loader dùng đúng nó.
async function runUserBackend(port: number) {
  const manifest = resolve(decls, profiles.dev);
  const myBackend = {
    name: "di-user-backend",
    async list() { return [{ id: "x1", title: "[DI] từ app/backend", done: false }]; },
    async add(title: string) { return { id: "x2", title, done: false }; },
    async toggle() { return null; },
  };
  console.log(`\n══════════ DI: opts.backend (user-owned) thắng manifest fallback ══════════`);
  const srv = makeServer(manifest, appCells, layouts, { backend: myBackend, i18n }).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const api = await get(port, "/todos?json=1");
    check("[di] dữ liệu đến từ backend user (sentinel [DI])", api.body.includes("[DI] từ app/backend"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function main() {
  await run("dev", 5190);
  await runOverride(5191);
  await runUserBackend(5192);
  console.log("\n→ Cùng cell + cùng makeServer, đổi manifest/backend → hành vi khác. Cell KHÔNG đổi dòng nào.");
  process.exit(failures === 0 ? 0 : 1);
}
main();
