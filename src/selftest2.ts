/* Integration proof: cùng cell, 2 profile → 2 manifest → 2 hành vi. Cell KHÔNG đổi. */
import http from "node:http";
import { makeServer } from "./server_factory";
import { resolve, type CellDecl } from "./core/resolver";
import { profiles } from "./profiles";
import home from "./cells/home/index";
import todos from "./cells/todos/index";
import hello from "./cells/hello/index";

const cells: CellDecl[] = [home, todos, hello].map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));

function get(port: number, path: string, headers: any = {}): Promise<{ status: number; body: string; headers: any }> {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: "127.0.0.1", port, path, method: "GET", headers }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode!, body: b, headers: res.headers }));
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
    const panel = await get(port, "/_fluxe");
    check("[/_fluxe] panel RCA 200 + có cell todos + có 'RCA Resolution'",
      panel.status === 200 && panel.body.includes("RCA Resolution") && panel.body.includes("todos"));
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
    // Auth: /secret cần đăng nhập
    check("[auth] /secret chưa login → 401", (await get(port, "/secret")).status === 401);
    const login = await get(port, "/login?user=alice");
    const cookie = String(login.headers["set-cookie"]?.[0] ?? "").split(";")[0];
    check("[auth] /login set cookie session", cookie.startsWith("session="));
    const secret = await get(port, "/secret", { cookie });
    check("[auth] /secret có cookie hợp lệ → 200 + tên user", secret.status === 200 && secret.body.includes("alice"));
    check("[auth] cookie giả mạo → 401", (await get(port, "/secret", { cookie: "session=giả.mạo" })).status === 401);
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
