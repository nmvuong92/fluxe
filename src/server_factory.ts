import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import type { CellDef } from "./core/engine";
import type { ResolutionManifest } from "./core/resolver";
import { backendsFromManifest } from "./core/wiring.ts";
import { renderResolutionPanel } from "./core/panel.ts";
import { makeRouter } from "./core/router.ts";
import { layoutChain } from "./core/layouts.ts";
import { layouts } from "../app/layouts/index";
import { renderHead, renderSitemap, renderRobots } from "./core/seo.ts";
import { FluxeError, toErrorPayload, renderErrorPage } from "./core/errors.ts";
import { signSession, verifySession, parseCookie, hasRole, hashPassword, verifyPassword, newCsrfToken } from "./core/auth.ts";
import { validateInput } from "./core/validate.ts";
import { createBroker } from "./core/broker.ts";
import { randomUUID } from "node:crypto";

const DEV = process.env.NODE_ENV !== "production";
const SECRET = process.env.FLUXE_SECRET ?? "dev-secret-change-me";

// Demo user store (password hash scrypt tạo lúc boot). App thật: lấy từ DB.
const USERS: Record<string, { hash: string; roles: string[] }> = {
  alice: { hash: hashPassword("secret"), roles: ["admin", "user"] },
  bob: { hash: hashPassword("secret"), roles: ["user"] },
};

function sendError(res: http.ServerResponse, wantsJson: boolean, err: unknown) {
  const errorId = randomUUID();
  const p = toErrorPayload(err, { dev: DEV, errorId });
  if (!(err instanceof FluxeError)) console.error(`[fluxe] unexpected ${errorId}:`, err);
  if (wantsJson) { res.writeHead(p.status, { "content-type": "application/json" }); res.end(JSON.stringify({ error: p })); }
  else { res.writeHead(p.status, { "content-type": "text/html; charset=utf-8" }); res.end(renderErrorPage(p)); }
}
import home from "../app/cells/home/index";
import todos from "../app/cells/todos/index";
import hello from "../app/cells/hello/index";
import secret from "../app/cells/secret/index";
import admin from "../app/cells/admin/index";

const cells: CellDef<any, any>[] = [home, todos, hello, secret, admin];
const matchRoute = makeRouter(cells);
const byId = new Map(cells.map(c => [c.id, c]));

function shell(cell: CellDef<any, any>, bodyHtml: string, data: any, shipClientJs: boolean) {
  const island = shipClientJs
    ? `<script>window.__FLUXE__=${JSON.stringify({ cell: cell.id, data })};</script><script type="module" src="/client.js"></script>`
    : `<!-- static: 0 JS -->`;
  const headHtml = renderHead(cell.head ? cell.head(data) : {});
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">${headHtml}</head><body><div id="root">${bodyHtml}</div>${island}</body></html>`;
}
const readBody = (req: http.IncomingMessage) => new Promise<string>(res => { let b=""; req.on("data",c=>b+=c); req.on("end",()=>res(b)); });

export function makeServer(manifest: ResolutionManifest) {
  // Backend GIẢI per-cell từ manifest (Resolution Plane) — cell/frontend giữ nguyên.
  const backends = backendsFromManifest(manifest);
  const backendFor = (id: string) => backends.byCell.get(id) ?? backends.default;
  const broker = createBroker();   // realtime pub/sub (Trục 4g, bản 1-node)
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const wantsJson = req.headers["x-fluxe"] === "1" || url.searchParams.get("json") === "1";
    const cookies = parseCookie(req.headers.cookie);
    const session = verifySession(cookies.session, SECRET);
    // CSRF double-submit: đảm bảo có cookie csrf (đặt nếu chưa) — client gửi lại qua header.
    let csrf = cookies.csrf;
    const csrfCookie = csrf ? "" : (csrf = newCsrfToken(), `csrf=${csrf}; Path=/; SameSite=Lax`);
    try {
    if (url.pathname === "/client.js") {
      if (existsSync("./dist/client.js")) { res.writeHead(200,{ "content-type":"text/javascript" }); return res.end(readFileSync("./dist/client.js")); }
      res.writeHead(404); return res.end("// no client");
    }
    if (url.pathname === "/_fluxe") {
      // Panel RCA — đọc manifest, hiển thị mỗi cell giải trục nào. (Prod: gate sau auth.)
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(renderResolutionPanel(manifest));
    }
    const baseUrl = "http://" + (req.headers.host ?? "localhost");
    if (url.pathname === "/sitemap.xml") {
      const staticRoutes = cells.map(c => c.route).filter(r => !r.includes("["));
      res.writeHead(200, { "content-type": "application/xml; charset=utf-8" });
      return res.end(renderSitemap(staticRoutes, baseUrl));
    }
    if (url.pathname === "/robots.txt") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      return res.end(renderRobots(baseUrl));
    }
    if (url.pathname === "/login" && req.method === "POST") {
      // POST {user, password} → verify password hash → set session + csrf cookie.
      const body = JSON.parse((await readBody(req)) || "{}");
      const u = USERS[body.user];
      if (!u || !verifyPassword(String(body.password ?? ""), u.hash)) {
        throw new FluxeError("unauthorized", "Sai tài khoản hoặc mật khẩu", 401);
      }
      const token = signSession({ user: body.user, roles: u.roles }, SECRET);
      res.writeHead(200, {
        "content-type": "application/json",
        "set-cookie": [`session=${token}; HttpOnly; Path=/; SameSite=Lax`, `csrf=${csrf}; Path=/; SameSite=Lax`],
      });
      return res.end(JSON.stringify({ user: body.user, roles: u.roles }));
    }
    if (url.pathname === "/logout") {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "set-cookie": "session=; HttpOnly; Path=/; Max-Age=0",
      });
      return res.end(`<p>Đã đăng xuất. <a href="/">trang chủ</a></p>`);
    }
    if (url.pathname.startsWith("/__sse/")) {
      // Realtime channel (SSE): giữ kết nối, đẩy event khi có publish trên topic.
      const topic = decodeURIComponent(url.pathname.slice("/__sse/".length));
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: ready\ndata: {"topic":"${topic}"}\n\n`);
      const off = broker.subscribe(topic, (data) => res.write(`data: ${JSON.stringify(data)}\n\n`));
      req.on("close", off);
      return;
    }
    if (url.pathname.startsWith("/__action/") && req.method === "POST") {
      // CSRF: header x-csrf-token phải khớp cookie csrf (double-submit).
      if (!cookies.csrf || req.headers["x-csrf-token"] !== cookies.csrf) {
        throw new FluxeError("csrf", "CSRF token không hợp lệ", 403);
      }
      const [,,cellId,name] = url.pathname.split("/");
      const fn = byId.get(cellId)?.actions?.[name];
      if (!fn) { res.writeHead(404); return res.end("no action"); }
      let input = JSON.parse((await readBody(req)) || "{}");
      const schema = (fn as any).inputSchema;
      if (schema) input = validateInput(schema, input);   // sai → FluxeError 400 (caught)
      const out = await fn({ input, backend: backendFor(cellId), session });
      broker.publish(cellId, { action: name, out });   // realtime: báo client khác
      res.writeHead(200,{ "content-type":"application/json" }); return res.end(JSON.stringify(out));
    }
    const match = matchRoute(url.pathname);
    if (!match) { res.writeHead(404); return res.end("404"); }
    const cell = match.cell;
    if ((cell.requireAuth || cell.requireRole) && !session) {
      throw new FluxeError("unauthorized", "Cần đăng nhập (/login)", 401);
    }
    if (cell.requireRole && !hasRole(session, cell.requireRole)) {
      throw new FluxeError("forbidden", `Cần quyền '${cell.requireRole}'`, 403);
    }
    const data = await cell.loader({ input: match.params, backend: backendFor(cell.id), session });
    if (wantsJson) { res.writeHead(200,{ "content-type":"application/json" }); return res.end(JSON.stringify({ cell: cell.id, data })); }
    let node: any = h(cell.view, { data });
    for (const id of layoutChain(cell.layout, layouts)) {   // inner→outer: bọc dần
      node = h(layouts[id].component as any, { children: node });
    }
    const bodyHtml = renderToString(node);
    const shipClientJs = manifest.cells[cell.id]?.render.shipClientJs ?? false;
    const pageHeaders: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
    if (csrfCookie) pageHeaders["set-cookie"] = csrfCookie;   // gửi csrf token cho client
    res.writeHead(200, pageHeaders); res.end(shell(cell, bodyHtml, data, shipClientJs));
    } catch (err) {
      // Error boundary ở biên request: domain → status/code; unexpected → 500 + errorId (không leak prod).
      // Action (rpc) luôn nhận lỗi dạng JSON.
      sendError(res, wantsJson || url.pathname.startsWith("/__action/"), err);
    }
  });
}
