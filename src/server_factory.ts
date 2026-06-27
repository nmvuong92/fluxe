// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { PassThrough } from "node:stream";
import { createElement as h } from "react";
import { renderToPipeableStream } from "react-dom/server";
import type { CellDef } from "./core/engine";
import type { ResolutionManifest } from "./core/resolver";
import { backendsFromManifest } from "./core/wiring.ts";
import { renderResolutionPanel } from "./core/panel.ts";
import { makeRouter } from "./core/router.ts";
import { layoutChain, type LayoutMeta } from "./core/layouts.ts";

// Layout do app cung cấp (DI) — engine không import ngược vào app/.
type LayoutEntry = LayoutMeta & { component: (props: { children: any }) => any };
type LayoutMap = Record<string, LayoutEntry>;
import { renderHead, renderSitemap, renderRobots } from "./core/seo.ts";
import { FluxeError, toErrorPayload, renderErrorPage } from "./core/errors.ts";
import { signSession, verifySession, parseCookie, hasRole, hashPassword, verifyPassword, newCsrfToken } from "./core/auth.ts";
import { validateInput } from "./core/validate.ts";
import { createBroker, type Broker } from "./core/broker.ts";
import { createContainer } from "./core/container.ts";
import { createRateLimiter } from "./core/ratelimit.ts";
import { createRecorder } from "./core/observe.ts";
import { createPresence, type Presence } from "./core/presence.ts";
import { etagOf, etagMatches } from "./core/etag.ts";
import { createRenderCache } from "./core/rendercache.ts";
import { parseChaos } from "./core/chaos.ts";
import { resolveLocale, makeT, type I18n, type TFn } from "./core/i18n.ts";
import { parseMultipart, boundaryFromContentType } from "./core/multipart.ts";
import { makeKey, type Storage } from "./storage/types.ts";
import { loadConfig, type FluxeConfig } from "./core/config.ts";

import { randomUUID, randomBytes } from "node:crypto";

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

// Phần head (trước body) và tail (sau body) — body được STREAM ở giữa.
function shellHead(cell: CellDef<any, any>, data: any, lang = "vi", theme = ""): string {
  const headHtml = renderHead(cell.head ? cell.head(data) : {});
  const themeAttr = theme ? ` data-theme="${theme}"` : "";   // theme-SSR: no-flash ngay lần đầu
  return `<!doctype html><html lang="${lang}"${themeAttr}><head><meta charset="utf-8">${headHtml}</head><body><div id="root">`;
}
function shellTail(cell: CellDef<any, any>, data: any, shipClientJs: boolean): string {
  const island = shipClientJs
    ? `<script>window.__FLUXE__=${JSON.stringify({ cell: cell.id, data, layout: cell.layout })};</script><script type="module" src="/client.js"></script>`
    : `<!-- static: 0 JS -->`;
  return `</div>${island}</body></html>`;
}
const readBody = (req: http.IncomingMessage) => new Promise<string>(res => { let b=""; req.on("data",c=>b+=c); req.on("end",()=>res(b)); });

/* Render React node THÀNH chuỗi HTML đầy đủ (gom hết stream) — dùng cho cache cell static.
 * Byte giống hệt đường stream: cùng renderToPipeableStream, chỉ gom lại 1 lần thay vì chảy. */
function renderBodyToString(node: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const sink = new PassThrough();
    sink.on("data", (c) => chunks.push(Buffer.from(c)));
    sink.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    sink.on("error", reject);
    const { pipe } = renderToPipeableStream(node, {
      onShellReady() { pipe(sink); },
      onError(e) { reject(e); },
    });
  });
}

export function makeServer(manifest: ResolutionManifest, cells: CellDef<any, any>[], layouts: LayoutMap = {}, opts: { i18n?: I18n; storage?: Storage; config?: FluxeConfig; backend?: unknown } = {}) {
  const i18n = opts.i18n;
  const storage = opts.storage;
  const config = opts.config ?? loadConfig();   // default ← ENV (FLUXE_*) ← override
  const MAX_UPLOAD = config.upload.maxBytes;
  const readBodyBuffer = (req: http.IncomingMessage) => new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_UPLOAD) { req.destroy(); reject(new FluxeError("upload", "File quá lớn", 413)); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
  // Cells được TIÊM từ app (DI) — engine không import ngược vào app/. Thêm trang = sửa app/app.ts.
  const matchRoute = makeRouter(cells);
  const byId = new Map(cells.map((c) => [c.id, c]));
  // Backend USER-OWNED (app/backend.ts) inject qua opts.backend → dùng cho mọi cell.
  // Nếu app không truyền → fallback driver built-in giải từ manifest (memory/sqlite) cho quick-start.
  const userBackend = opts.backend;
  const backends = userBackend === undefined ? backendsFromManifest(manifest) : null;
  const backendFor = (id: string) => userBackend ?? backends!.byCell.get(id) ?? backends!.default;
  // Resolved Container: service realtime đăng ký LƯỜI — chỉ tạo khi thật sự dùng (SSE/action).
  // App không realtime → broker/presence KHÔNG bao giờ bootstrap. resolved() ở /_fluxe/stats.
  const container = createContainer();
  container.register("broker", () => createBroker());
  container.register("presence", () => createPresence());
  const actionLimit = createRateLimiter(config.rateLimit);   // per-IP cho action (FLUXE_RATELIMIT_*)
  const recorder = createRecorder();   // request log — chạy mỗi request → eager (luôn dùng)
  const renderCache = createRenderCache({ maxKeys: config.renderCache.maxKeys });   // FLUXE_RENDERCACHE_MAX_KEYS
  let clientJs: Buffer | undefined;    // ý A: đọc dist/client.js 1 lần (zero-copy: tái dùng buffer)
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const start = Date.now();
    res.on("finish", () => recorder.record({ method: req.method ?? "?", path: url.pathname, status: res.statusCode, ms: Date.now() - start, ts: start }));
    const wantsJson = req.headers["x-fluxe"] === "1" || url.searchParams.get("json") === "1";
    const cookies = parseCookie(req.headers.cookie);
    const session = verifySession(cookies.session, SECRET);
    // CSRF double-submit: đảm bảo có cookie csrf (đặt nếu chưa) — client gửi lại qua header.
    let csrf = cookies.csrf;
    const csrfCookie = csrf ? "" : (csrf = newCsrfToken(), `csrf=${csrf}; Path=/; SameSite=Lax`);
    // Resolved Shell: locale (i18n) + theme — giải từ cookie/header, đưa vào loader + <html>.
    const locale = i18n ? resolveLocale(i18n, { cookie: cookies.locale, acceptLanguage: req.headers["accept-language"] }) : "vi";
    const t: TFn = i18n ? makeT(i18n, locale) : (k) => k;
    const theme = cookies.theme === "dark" || cookies.theme === "light" ? cookies.theme : "";
    try {
    // Đổi ngôn ngữ qua ?locale=xx → set cookie + redirect (chạy cả trên cell static, 0 JS).
    {
      const ql = url.searchParams.get("locale");
      if (i18n && ql && i18n.locales.includes(ql)) {
        url.searchParams.delete("locale");
        res.writeHead(303, { "set-cookie": `locale=${ql}; Path=/; SameSite=Lax`, location: url.pathname + (url.search || "") });
        return res.end();
      }
    }
    if (url.pathname === "/client.js") {
      if (clientJs === undefined && existsSync("./dist/client.js")) clientJs = readFileSync("./dist/client.js");
      if (clientJs !== undefined) { res.writeHead(200,{ "content-type":"text/javascript" }); return res.end(clientJs); }
      res.writeHead(404); return res.end("// no client");
    }
    if (url.pathname === "/_fluxe/stats") {
      const m = process.memoryUsage(); const c = process.cpuUsage();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ rss: m.rss, heapUsed: m.heapUsed, cpuUser: c.user, cpuSystem: c.system, uptimeMs: Math.round(process.uptime() * 1000), bootstrapped: container.resolved() }));
    }
    if (url.pathname === "/_fluxe/requests") {
      // Observability: log request gần đây (timing/status). Prod: gate sau auth.
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(recorder.recent()));
    }
    if (url.pathname === "/_fluxe") {
      // Panel RCA — đọc manifest, hiển thị mỗi cell giải trục nào. (Prod: gate sau auth.)
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(renderResolutionPanel(manifest, recorder.recent(20)));
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
    // File upload: POST /__upload/<field> → parse multipart → storage.put. CSRF + giới hạn size.
    if (url.pathname.startsWith("/__upload/") && req.method === "POST") {
      if (!storage) { res.writeHead(501); return res.end(JSON.stringify({ error: { code: "no_storage", message: "Chưa cấu hình storage", status: 501 } })); }
      if (!cookies.csrf || req.headers["x-csrf-token"] !== cookies.csrf) throw new FluxeError("csrf", "CSRF không hợp lệ", 403);
      const boundary = boundaryFromContentType(req.headers["content-type"]);
      if (!boundary) throw new FluxeError("upload", "Cần multipart/form-data", 400);
      const files = parseMultipart(await readBodyBuffer(req), boundary).filter((p) => p.filename);
      if (!files.length) throw new FluxeError("upload", "Không có file", 400);
      const out = [];
      for (const f of files) {
        const key = makeKey(f.filename!, randomBytes(8).toString("hex"));
        out.push(await storage.put(key, f.data, { contentType: f.contentType }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(out.length === 1 ? out[0] : out));
    }
    // Serve file: GET /__file/<key> → storage.get → stream về.
    if (url.pathname.startsWith("/__file/") && req.method === "GET") {
      if (!storage) { res.writeHead(404); return res.end(); }
      const key = decodeURIComponent(url.pathname.slice("/__file/".length));
      const file = await storage.get(key);
      if (!file) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": file.contentType ?? "application/octet-stream", "content-length": String(file.size) });
      return res.end(file.data);
    }
    if (url.pathname.startsWith("/__sse/")) {
      // Realtime channel (SSE): giữ kết nối, đẩy event khi publish trên topic. ?id= → presence.
      const topic = decodeURIComponent(url.pathname.slice("/__sse/".length));
      const id = url.searchParams.get("id");
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: ready\ndata: {"topic":"${topic}"}\n\n`);
      // Lần đầu có client SSE → broker + presence mới bootstrap (lazy qua container).
      const broker = container.get<Broker>("broker");
      const presence = container.get<Presence>("presence");
      const offBroker = broker.subscribe(topic, (data) => res.write(`data: ${JSON.stringify(data)}\n\n`));
      let offPresence = () => {};
      if (id) {
        offPresence = presence.join(topic, id);
        broker.publish(topic, { presence: presence.members(topic) });  // báo mọi người trong topic
      }
      req.on("close", () => {
        offBroker();
        offPresence();
        if (id) broker.publish(topic, { presence: presence.members(topic) });
      });
      return;
    }
    if (url.pathname.startsWith("/__action/") && req.method === "POST") {
      // Rate limit per-IP → 429 + Retry-After (bảo vệ trước CSRF/handler).
      const ip = req.socket.remoteAddress ?? "?";
      const rl = actionLimit.take("act:" + ip);
      if (!rl.ok) {
        res.writeHead(429, { "content-type": "application/json", "retry-after": String(rl.retryAfter) });
        return res.end(JSON.stringify({ error: { status: 429, code: "rate_limited", message: "Quá nhiều request" } }));
      }
      // CSRF: header x-csrf-token phải khớp cookie csrf (double-submit).
      if (!cookies.csrf || req.headers["x-csrf-token"] !== cookies.csrf) {
        throw new FluxeError("csrf", "CSRF token không hợp lệ", 403);
      }
      const [,,cellId,name] = url.pathname.split("/");
      const fn = byId.get(cellId)?.actions?.[name];
      if (!fn) { res.writeHead(404); return res.end("no action"); }
      const t0 = Date.now();
      // DevTools (DEV): #3 resolution (backend TS in-process do manifest giải).
      const backend = backendFor(cellId);
      const r = manifest.cells[cellId]?.backend;
      const resolution = r ? `${r.language}/in-process` : "memory/in-process";
      // #1 Chaos (DEV): inject delay + lỗi giả lập để test UX.
      if (DEV && req.headers["x-fluxe-chaos"]) {
        const c = parseChaos(String(req.headers["x-fluxe-chaos"]));
        if (c.delayMs) await new Promise((rr) => setTimeout(rr, c.delayMs));
        if (c.failRate && Math.random() < c.failRate) throw new FluxeError("chaos", "Chaos: lỗi giả lập", 500);
      }
      let input = JSON.parse((await readBody(req)) || "{}");
      const schema = (fn as any).inputSchema;
      if (schema) input = validateInput(schema, input);   // sai → FluxeError 400 (caught)
      const out = await fn({ input, backend, session });
      container.get<Broker>("broker").publish(cellId, { action: name, out });   // realtime: báo client khác (broker lazy)
      res.writeHead(200, { "content-type": "application/json", "x-fluxe-resolution": resolution, "x-fluxe-server-ms": String(Date.now() - t0) });
      return res.end(JSON.stringify(out));
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
    const data = await cell.loader({ input: match.params, backend: backendFor(cell.id), session, locale, t });
    if (wantsJson) {
      const body = JSON.stringify({ cell: cell.id, data, layout: cell.layout });
      const etag = etagOf(body);   // render cache: 304 nếu props không đổi
      if (etagMatches(req.headers["if-none-match"], etag)) { res.writeHead(304, { etag }); return res.end(); }
      res.writeHead(200, { "content-type": "application/json", etag }); return res.end(body);
    }
    let node: any = h(cell.view, { data });
    const shellCtx = { locale, t, theme, path: url.pathname };   // Resolved Shell ctx cho layout
    for (const id of layoutChain(cell.layout, layouts)) {   // inner→outer: bọc dần
      node = h(layouts[id].component as any, { children: node, ctx: shellCtx });
    }
    const shipClientJs = manifest.cells[cell.id]?.render.shipClientJs ?? false;
    const pageHeaders: Record<string, string> = { "content-type": "text/html; charset=utf-8" };
    if (csrfCookie) pageHeaders["set-cookie"] = csrfCookie;   // gửi csrf token cho client
    // Ý B — render cache cell static: render 1 lần → giữ Buffer → ghi lại (zero-copy).
    // Gate etag(data): data đổi ⇒ miss ⇒ render lại (không trả HTML cũ). Chỉ cell static & public.
    if (manifest.cells[cell.id]?.render.mode === "static" && cell.cache !== false && !cell.requireAuth && !cell.requireRole) {
      const etag = etagOf(JSON.stringify(data) + "|" + locale + "|" + theme);   // lang/theme đổi → bust cache
      let hit = renderCache.get(url.pathname);
      if (!hit || hit.etag !== etag) {
        const full = shellHead(cell, data, locale, theme) + await renderBodyToString(node) + shellTail(cell, data, shipClientJs);
        hit = { etag, buf: Buffer.from(full, "utf8") };
        renderCache.set(url.pathname, hit);
      }
      res.writeHead(200, pageHeaders);
      return res.end(hit.buf);
    }
    // Streaming SSR: gửi head ngay → stream body (Suspense chảy dần) → tail khi xong.
    res.writeHead(200, pageHeaders);
    res.write(shellHead(cell, data, locale, theme));
    const through = new PassThrough();
    through.on("data", (c) => res.write(c));
    through.on("end", () => { res.write(shellTail(cell, data, shipClientJs)); res.end(); });
    const { pipe } = renderToPipeableStream(node, {
      onShellReady() { pipe(through); },                       // shell sẵn → bắt đầu stream
      onError(e) { console.error("[fluxe] ssr stream error:", e); },
    });
    } catch (err) {
      // Error boundary ở biên request: domain → status/code; unexpected → 500 + errorId (không leak prod).
      // Action (rpc) luôn nhận lỗi dạng JSON.
      sendError(res, wantsJson || url.pathname.startsWith("/__action/"), err);
    }
  });
}
