// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Integration proof: cùng cell, 2 profile → 2 manifest → 2 hành vi. Cell KHÔNG đổi. */
import http from "node:http";
import { makeServer } from "./server_factory";
import { resolve, type CellDecl } from "./core/resolver";
import { profiles } from "../app/profiles";
import { cells as appCells } from "../app/app";
import { layouts } from "../app/layouts/index";
import { backend } from "../app/backend/data";   // data user-owned (DI)
import { resolvers } from "../app/backend/index";   // contract resolvers (/__rpc)
import { contract } from "../app/contract";
import { i18n } from "../app/i18n";   // cell i18n (home dịch title qua t) → cần cho SEO/render

const cells: CellDecl[] = appCells.map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));

function get(port: number, path: string, headers: any = {}): Promise<{ status: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode!, body: b, headers: res.headers }));
    });
    r.on("error", reject); r.end();
  });
}

function post(port: number, path: string, body: any, headers: any = {}): Promise<{ status: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const r = http.request({ host: "127.0.0.1", port, path, method: "POST",
      headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data), ...headers } }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode!, body: b, headers: res.headers }));
    });
    r.on("error", reject); r.write(data); r.end();
  });
}

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
}

async function run(profileName: string, port: number) {
  const manifest = resolve(cells, profiles[profileName]);
  console.log(`\n══════════ profile=${profileName} (backend=${backend.name}) ══════════`);
  const srv = makeServer(manifest, appCells, layouts, { backend, resolvers, contract, i18n }).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const homePage = await get(port, "/");
    check("[static /] KHÔNG gửi client.js", !homePage.body.includes("/client.js"));
    // Contract DSL: /__rpc/<op> từ contract thật + resolvers (DB ẩn). CSRF do host lo, fluxe chỉ validate.
    const rpcTodos = await post(port, "/__rpc/todos", {});
    const todosOut = JSON.parse(rpcTodos.body);
    check("[contract] /__rpc/todos (query) → mảng todo từ resolver", rpcTodos.status === 200 && Array.isArray(todosOut));
    const rpcBad = await post(port, "/__rpc/addTodo", { title: 123 });
    check("[contract] /__rpc/addTodo title sai kiểu → 400 (Zod từ contract)", rpcBad.status === 400);
    const todosPage = await get(port, "/todos");
    check("[island /todos] CÓ gửi client.js", todosPage.body.includes("/client.js"));
    const apiRes = await get(port, "/todos?json=1");
    const api = JSON.parse(apiRes.body);
    check(`[backend] tên hiển thị = ${backend.name}`, api.data.backendName === backend.name);
    // Render cache: ETag → If-None-Match khớp → 304 (không gửi lại body).
    const etag = apiRes.headers.etag;
    const notMod = await get(port, "/todos?json=1", { "if-none-match": etag });
    check("[cache] JSON props ETag + If-None-Match → 304 (body rỗng)", typeof etag === "string" && notMod.status === 304 && notMod.body === "");
    const panel = await get(port, "/_fluxe");
    check("[/_fluxe] dashboard: RCA Resolution + cell todos + Recent requests",
      panel.status === 200 && panel.body.includes("RCA Resolution") && panel.body.includes("todos") && panel.body.includes("Recent requests"));
    const hello = JSON.parse((await get(port, "/hello/world?json=1")).body);
    check("[route động /hello/[name]] param 'world' tới loader", hello.data?.name === "world");
    check("[route động] no-match → 404", (await get(port, "/nope/x/y")).status === 404);
    const todosHtml = (await get(port, "/todos")).body;
    const iSite = todosHtml.indexOf("fluxe site"), iNav = todosHtml.indexOf("app nav"), iUl = todosHtml.indexOf("<ul");
    check("[layout] nested site>app>todos đúng thứ tự lồng", iSite >= 0 && iNav > iSite && iUl > iNav);
    const homeHtml = (await get(port, "/")).body;
    check("[SEO] home có <title> riêng + canonical", homeHtml.includes("<title>fluxe — fullstack tối giản</title>") && homeHtml.includes('rel="canonical"'));
    const sm = await get(port, "/sitemap.xml");
    check("[SEO] /sitemap.xml liệt kê route tĩnh, bỏ [param]", sm.status === 200 && sm.body.includes("/todos</loc>") && !sm.body.includes("[name]"));
    const rb = await get(port, "/robots.txt");
    check("[SEO] /robots.txt trỏ sitemap", rb.status === 200 && rb.body.includes("Sitemap:"));
    const dom = await get(port, "/hello/boom?json=1");
    const domBody = JSON.parse(dom.body);
    check("[err] domain FluxeError → status 403 + code forbidden", dom.status === 403 && domBody.error?.code === "forbidden");
    const unx = await get(port, "/hello/crash?json=1");
    const unxBody = JSON.parse(unx.body);
    check("[err] unexpected → 500 + code internal + có errorId", unx.status === 500 && unxBody.error?.code === "internal" && !!unxBody.error?.errorId);
    check("[err] một lỗi không sập server: request sau vẫn 200", (await get(port, "/hello/ok")).status === 200);
    // Guard cell-level: /secret requireAuth, chưa có session (host chưa gắn) → 401.
    check("[guard] /secret chưa có session host → 401", (await get(port, "/secret")).status === 401);
    // Validation action (CSRF do host lo — fluxe không kiểm): input sai → 400 validation + details.
    const bad = await post(port, "/__action/todos/add", { title: "" });
    check("[validate] add title rỗng → 400 + code=validation + details", bad.status === 400 && JSON.parse(bad.body).error?.code === "validation" && Array.isArray(JSON.parse(bad.body).error?.details));
    const okAdd = await post(port, "/__action/todos/add", { title: "việc hợp lệ" });
    check("[validate] add title hợp lệ → 200 + tạo todo", okAdd.status === 200 && JSON.parse(okAdd.body).title.includes("việc hợp lệ"));
    // Realtime SSE: mở kết nối, add → client nhận event live.
    const sseEvents: string[] = [];
    const sseReq = http.request({ host: "127.0.0.1", port, path: "/__sse/todos", method: "GET" }, (res) => {
      res.on("data", (c) => sseEvents.push(c.toString()));
    });
    sseReq.end();
    await new Promise((r) => setTimeout(r, 100));
    await post(port, "/__action/todos/add", { title: "todo realtime" });
    await new Promise((r) => setTimeout(r, 120));
    check("[sse] client nhận event live sau khi add", sseEvents.join("").includes("todo realtime"));
    sseReq.destroy();
    // Presence: client A mở SSE với ?id, client B join → A nhận presence có cả 2.
    const aEvents: string[] = [];
    const aReq = http.request({ host: "127.0.0.1", port, path: "/__sse/room?id=alice", method: "GET" }, (res) => res.on("data", (c) => aEvents.push(c.toString())));
    aReq.end();
    await new Promise((r) => setTimeout(r, 80));
    const bReq = http.request({ host: "127.0.0.1", port, path: "/__sse/room?id=bob", method: "GET" }, () => {});
    bReq.end();
    await new Promise((r) => setTimeout(r, 120));
    check("[presence] A nhận presence chứa alice + bob khi B join", aEvents.join("").includes("alice") && aEvents.join("").includes("bob"));
    aReq.destroy(); bReq.destroy();
    // Streaming SSR: /slow có Suspense — shell gửi NGAY (TTFB nhỏ), slow content stream ~150ms sau.
    const chunks: { t: number; s: string }[] = [];
    const t0 = Date.now();
    await new Promise<void>((resolve) => {
      http.get({ host: "127.0.0.1", port, path: "/slow" }, (res) => {
        res.on("data", (c) => chunks.push({ t: Date.now() - t0, s: c.toString() }));
        res.on("end", () => resolve());
      });
    });
    const firstT = chunks[0]?.t ?? 999;
    const totalT = chunks.at(-1)?.t ?? 0;
    const full = chunks.map((c) => c.s).join("");
    check(`[stream] shell sớm (TTFB ${firstT}ms) < slow content (${totalT}ms) — streaming thật`,
      full.includes("shell gửi ngay") && full.includes("nội dung chậm") && firstT < 90 && firstT < totalT - 50);
    // (Rate-limit ĐÃ GỠ — host framework lo. fluxe = cầu nối RCA.)
    // Observability: request log ghi path/status/ms. Gọi marker ngay trước để nằm trong recent.
    await get(port, "/todos");
    const logs = JSON.parse((await get(port, "/_fluxe/requests")).body);
    check("[observe] /_fluxe/requests log request (có /todos + status + ms)",
      Array.isArray(logs) && logs.some((e: any) => e.path === "/todos" && typeof e.status === "number" && typeof e.ms === "number"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

// Đối chứng: manifest có quyền TỐI CAO trên cell.hydration.
// Ép home (vốn static) thành ship JS qua manifest — pre-refactor (dùng cell.hydration)
// sẽ KHÔNG ship → fail; post-refactor (đọc manifest) sẽ ship → pass.
async function runOverride(port: number) {
  const manifest = resolve(cells, profiles.dev);
  manifest.cells.home.render.shipClientJs = true; // override static → ship
  console.log(`\n══════════ override: manifest ép home ship JS (đối chứng quyền manifest) ══════════`);
  const srv = makeServer(manifest, appCells, layouts, { backend }).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const homePage = await get(port, "/");
    check("[override] home (static) GỬI client.js vì manifest ép → manifest > cell.hydration", homePage.body.includes("/client.js"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

// Đối chứng: backend USER-OWNED inject qua opts.backend → engine dùng đúng nó (bỏ manifest fallback).
async function runUserBackend(port: number) {
  const manifest = resolve(cells, profiles.dev);
  // Backend "của user" — tên + dữ liệu sentinel để chứng minh DI đi xuyên tới loader.
  const myBackend = {
    name: "di-user-backend",
    async listTodos() { return [{ id: "x1", title: "[DI] từ app/backend", done: false }]; },
    async addTodo(title: string) { return { id: "x2", title, done: false }; },
    async toggleTodo() { return []; },
  };
  console.log(`\n══════════ DI: opts.backend (user-owned) thắng manifest fallback ══════════`);
  const srv = makeServer(manifest, appCells, layouts, { backend: myBackend }).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const api = await get(port, "/todos?json=1");
    check("[di] loader nhận backend của user (name=di-user-backend)", api.body.includes("di-user-backend"));
    check("[di] dữ liệu đến từ backend user (sentinel [DI])", api.body.includes("[DI] từ app/backend"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function main() {
  await run("dev", 5190);          // backend memory in-process (manifest fallback)
  await runOverride(5191);         // chứng minh manifest điều khiển render, không phải cell.hydration
  await runUserBackend(5192);      // chứng minh opts.backend (user-owned) được inject vào cell
  console.log("\n→ Cùng cell + cùng makeServer, đổi manifest/backend → hành vi khác. Cell KHÔNG đổi dòng nào.");
  process.exit(failures === 0 ? 0 : 1);
}
main();
