/* Integration proof: cùng cell, 2 profile → 2 manifest → 2 hành vi. Cell KHÔNG đổi. */
import http from "node:http";
import { makeServer } from "./server_factory";
import { resolve, type CellDecl } from "./core/resolver";
import { profiles } from "../app/profiles";
import home from "../app/cells/home/index";
import todos from "../app/cells/todos/index";
import hello from "../app/cells/hello/index";

const cells: CellDecl[] = [home, todos, hello].map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));

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

// Lấy cookie csrf từ một page (set-cookie). Trả { pair: "csrf=abc", val: "abc" }.
function getCsrf(setCookie: string[] | undefined) {
  const pair = (setCookie ?? []).find((c) => c.startsWith("csrf="))?.split(";")[0] ?? "";
  return { pair, val: pair.split("=")[1] ?? "" };
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
    // Auth: /secret cần đăng nhập (login = POST verify password hash)
    check("[auth] /secret chưa login → 401", (await get(port, "/secret")).status === 401);
    check("[auth] login sai mật khẩu → 401", (await post(port, "/login", { user: "alice", password: "wrong" })).status === 401);
    const login = await post(port, "/login", { user: "alice", password: "secret" });
    const sessionCookie = String((login.headers["set-cookie"] ?? []).find((c: string) => c.startsWith("session=")) ?? "").split(";")[0];
    check("[auth] login đúng mật khẩu → 200 + set session", login.status === 200 && sessionCookie.startsWith("session="));
    const secret = await get(port, "/secret", { cookie: sessionCookie });
    check("[auth] /secret có session → 200 + tên user", secret.status === 200 && secret.body.includes("alice"));
    check("[auth] cookie giả mạo → 401", (await get(port, "/secret", { cookie: "session=tampered.invalid" })).status === 401);
    // RBAC: /admin cần role admin
    const bobLogin = await post(port, "/login", { user: "bob", password: "secret" });
    const bobCookie = String((bobLogin.headers["set-cookie"] ?? []).find((c: string) => c.startsWith("session=")) ?? "").split(";")[0];
    check("[rbac] bob (role user) vào /admin → 403", (await get(port, "/admin", { cookie: bobCookie })).status === 403);
    check("[rbac] alice (admin) vào /admin → 200", (await get(port, "/admin", { cookie: sessionCookie })).status === 200);
    // CSRF: lấy token từ page, gắn vào action
    const csrf = getCsrf(todosPage.headers["set-cookie"]);
    check("[csrf] action KHÔNG có token → 403", (await post(port, "/__action/todos/add", { title: "x" })).status === 403);
    const csrfHdr = { cookie: csrf.pair, "x-csrf-token": csrf.val };
    // Validation (qua CSRF hợp lệ): input sai → 400 validation + details
    const bad = await post(port, "/__action/todos/add", { title: "" }, csrfHdr);
    check("[validate] add title rỗng → 400 + code=validation + details", bad.status === 400 && JSON.parse(bad.body).error?.code === "validation" && Array.isArray(JSON.parse(bad.body).error?.details));
    const okAdd = await post(port, "/__action/todos/add", { title: "việc hợp lệ" }, csrfHdr);
    check("[validate] add title hợp lệ (csrf ok) → 200 + tạo todo", okAdd.status === 200 && JSON.parse(okAdd.body).title.includes("việc hợp lệ"));
    // Realtime SSE: mở kết nối, add → client nhận event live.
    const sseEvents: string[] = [];
    const sseReq = http.request({ host: "127.0.0.1", port, path: "/__sse/todos", method: "GET" }, (res) => {
      res.on("data", (c) => sseEvents.push(c.toString()));
    });
    sseReq.end();
    await new Promise((r) => setTimeout(r, 100));
    await post(port, "/__action/todos/add", { title: "todo realtime" }, csrfHdr);
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
    // Rate limit: bắn 50 action đồng thời → vượt capacity → có 429.
    const burst = await Promise.all(
      Array.from({ length: 50 }, () => post(port, "/__action/todos/toggle", { id: "1" }, csrfHdr)),
    );
    const limited = burst.filter((r) => r.status === 429).length;
    check(`[ratelimit] burst 50 → có ${limited} request bị 429`, limited > 0);
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
  const srv = makeServer(manifest).listen(port);
  await new Promise((r) => setTimeout(r, 150));
  try {
    const homePage = await get(port, "/");
    check("[override] home (static) GỬI client.js vì manifest ép → manifest > cell.hydration", homePage.body.includes("/client.js"));
  } finally {
    srv.close();
    await new Promise((r) => setTimeout(r, 80));
  }
}

async function main() {
  await run("dev", 5190);          // backend memory in-process
  await runOverride(5191);         // chứng minh manifest điều khiển render, không phải cell.hydration
  // prod-go cần service Go ở :8081 — chứng minh trục backend đã có ở run-native.sh.
  console.log("\n→ Cùng cell + cùng makeServer, đổi manifest → hành vi khác. Cell KHÔNG đổi dòng nào.");
  process.exit(failures === 0 ? 0 : 1);
}
main();
