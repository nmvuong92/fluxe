// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { PassThrough } from "node:stream";
import { createElement as h } from "react";
import { renderToPipeableStream } from "react-dom/server";
import type { CellDef } from "./core/engine";
import type { ResolutionManifest } from "./core/resolver";
import { renderResolutionPanel } from "./core/panel.ts";
import { makeRouter } from "./core/router.ts";
import { layoutChain, type LayoutMeta } from "./core/layouts.ts";

// Layout do app cung cấp (DI) — engine không import ngược vào app/.
type LayoutEntry = LayoutMeta & { component: (props: { children: any }) => any };
type LayoutMap = Record<string, LayoutEntry>;
import { renderHead, renderSitemap, renderRobots } from "./core/seo.ts";
import { FluxeError, toErrorPayload, renderErrorPage } from "./core/errors.ts";
import { parseCookie } from "./core/cookie.ts";
import { validateInput } from "./core/validate.ts";
import { createBroker } from "./core/broker.ts";
import { handleRpc } from "./core/rpc.ts";
import type { Contract } from "./core/contract.ts";
import { createRecorder } from "./core/observe.ts";
import { createPresence } from "./core/presence.ts";
import { etagOf, etagMatches } from "./core/etag.ts";
import { createRenderCache } from "./core/rendercache.ts";
import { parseChaos } from "./core/chaos.ts";
import { resolveLocale, makeT, type I18n, type TFn } from "./core/i18n.ts";
import { loadConfig, type FluxeConfig } from "./core/config.ts";

import { randomUUID } from "node:crypto";

const DEV = process.env.NODE_ENV !== "production";

// Phân quyền: đọc session do HOST gắn (req.session). fluxe không verify — host lo auth/csrf/ratelimit.
const sessionHasRole = (s: any, role: string): boolean => Array.isArray(s?.roles) && s.roles.includes(role);

function sendError(res: http.ServerResponse, wantsJson: boolean, err: unknown) {
  const errorId = randomUUID();
  const p = toErrorPayload(err, { dev: DEV, errorId });
  if (!(err instanceof FluxeError)) console.error(`[fluxe] unexpected ${errorId}:`, err);
  if (wantsJson) { res.writeHead(p.status, { "content-type": "application/json" }); res.end(JSON.stringify({ error: p })); }
  else { res.writeHead(p.status, { "content-type": "text/html; charset=utf-8" }); res.end(renderErrorPage(p)); }
}

// Phần head (trước body) và tail (sau body) — body được STREAM ở giữa.
function shellHead(cell: CellDef<any, any, any, any>, data: any, lang = "vi", theme = ""): string {
  const headHtml = renderHead(cell.head ? cell.head(data) : {});
  const themeAttr = theme ? ` data-theme="${theme}"` : "";   // theme-SSR: no-flash ngay lần đầu
  return `<!doctype html><html lang="${lang}"${themeAttr}><head><meta charset="utf-8">${headHtml}</head><body><div id="root">`;
}
function shellTail(cell: CellDef<any, any, any, any>, data: any, shipClientJs: boolean): string {
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

export interface MakeServerOpts { i18n?: I18n; config?: FluxeConfig; backend?: unknown; contract?: Contract; resolvers?: unknown }
export type NodeHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<unknown>;

/* createHandler — lõi request framework-agnostic: trả về handler Node (req,res).
 * Dùng trực tiếp cho adapter Express/Hono/Nest; makeServer chỉ bọc bằng http.createServer. */
export function createHandler(manifest: ResolutionManifest, cells: CellDef<any, any, any, any>[], layouts: LayoutMap = {}, opts: MakeServerOpts = {}): NodeHandler {
  const i18n = opts.i18n;
  const config = opts.config ?? loadConfig();   // default ← ENV (FLUXE_*) ← override
  // Cells được TIÊM từ app (DI) — engine không import ngược vào app/. Thêm trang = sửa app/app.ts.
  const matchRoute = makeRouter(cells);
  const byId = new Map(cells.map((c) => [c.id, c]));
  // Backend USER-OWNED (app/backend.ts) inject qua opts.backend → dùng cho mọi cell.
  const backendFor = (_id: string) => opts.backend;
  // Realtime (RCA: live-update on action) — broker + presence eager (đơn giản, dependency-free).
  const broker = createBroker();
  const presence = createPresence();
  const recorder = createRecorder();   // observability: request log (ring buffer)
  const renderCache = createRenderCache({ maxKeys: config.renderCache.maxKeys });   // FLUXE_RENDERCACHE_MAX_KEYS
  let clientJs: Buffer | undefined;    // ý A: đọc dist/client.js 1 lần (zero-copy: tái dùng buffer)
  return async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const start = Date.now();
    res.on("finish", () => recorder.record({ method: req.method ?? "?", path: url.pathname, status: res.statusCode, ms: Date.now() - start, ts: start }));
    const wantsJson = req.headers["x-fluxe"] === "1" || url.searchParams.get("json") === "1";
    const cookies = parseCookie(req.headers.cookie);   // engine chỉ đọc cookie locale/theme
    const session = (req as any).session ?? null;       // session do HOST gắn (fluxe không verify)
    // Resolved Shell: locale (i18n) + theme — giải từ cookie/header, đưa vào loader + <html>.
    const locale = i18n ? resolveLocale(i18n, { cookie: cookies.locale, acceptLanguage: req.headers["accept-language"] }) : "vi";
    const t: TFn = i18n ? makeT(i18n, locale) : (k) => k;
    const theme = cookies.theme === "dark" || cookies.theme === "light" ? cookies.theme : "";
    try {
    // Contract DSL: POST /__rpc/<op> — validate Zod + CSRF(mutation) → resolver (opts.backend). Lớp THÊM.
    if (await handleRpc({ url, req, res, cookies, session, resolvers: opts.resolvers ?? opts.backend, contract: opts.contract, readBody, publish: broker.publish, trace: config.trace })) return;
    // Đổi ngôn ngữ qua ?locale=xx → set cookie + redirect (chạy cả trên cell static, 0 JS).
    {
      const ql = url.searchParams.get("locale");
      if (i18n && ql && i18n.locales.includes(ql)) {
        url.searchParams.delete("locale");
        res.writeHead(303, { "set-cookie": `locale=${ql}; Path=/; SameSite=Lax`, location: url.pathname + (url.search || "") });
        return res.end();
      }
    }
    if (url.pathname === "/__session") {
      // Auth integration: phơi session host gắn (req.session) cho client hook useSession(). fluxe không verify.
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(session ?? null));
    }
    if (url.pathname === "/client.js") {
      if (clientJs === undefined && existsSync("./dist/client.js")) clientJs = readFileSync("./dist/client.js");
      if (clientJs !== undefined) { res.writeHead(200,{ "content-type":"text/javascript" }); return res.end(clientJs); }
      res.writeHead(404); return res.end("// no client");
    }
    if (url.pathname === "/_fluxe/stats") {
      const m = process.memoryUsage(); const c = process.cpuUsage();
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ rss: m.rss, heapUsed: m.heapUsed, cpuUser: c.user, cpuSystem: c.system, uptimeMs: Math.round(process.uptime() * 1000) }));
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
    // (auth /login·/logout, file /__upload·/__file ĐÃ GỠ — host framework + ecosystem lo.)
    if (url.pathname.startsWith("/__sse/")) {
      // Realtime channel (SSE): giữ kết nối, đẩy event khi publish trên topic. ?id= → presence.
      const topic = decodeURIComponent(url.pathname.slice("/__sse/".length));
      const id = url.searchParams.get("id");
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`event: ready\ndata: {"topic":"${topic}"}\n\n`);
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
      // CSRF + rate-limit do HOST middleware lo (mount trước fluxe). fluxe chỉ dispatch + validate.
      const [,,cellId,name] = url.pathname.split("/");
      const fn = byId.get(cellId)?.actions?.[name];
      if (!fn) { res.writeHead(404); return res.end("no action"); }
      const t0 = Date.now();
      // DevTools (DEV): #3 resolution (render mode của cell; data = backend user-owned).
      const backend = backendFor(cellId);
      const render = manifest.cells[cellId]?.render;
      const resolution = render ? `${render.mode}/${(backend as any)?.name ?? "no-backend"}` : "island";
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
      broker.publish(cellId, { action: name, out });   // realtime: báo client khác (RCA live-update)
      res.writeHead(200, { "content-type": "application/json", "x-fluxe-resolution": resolution, "x-fluxe-server-ms": String(Date.now() - t0) });
      return res.end(JSON.stringify(out));
    }
    const match = matchRoute(url.pathname);
    if (!match) { res.writeHead(404); return res.end("404"); }
    const cell = match.cell;
    // Guard cell-level: đọc session HOST gắn (host lo verify/login; fluxe chỉ chặn theo khai báo cell).
    if ((cell.requireAuth || cell.requireRole) && !session) {
      throw new FluxeError("unauthorized", "Cần đăng nhập (host auth)", 401);
    }
    if (cell.requireRole && !sessionHasRole(session, cell.requireRole)) {
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
  };
}

/* makeServer — đường zero-config: bọc createHandler bằng http.createServer (giữ API cũ). */
export function makeServer(manifest: ResolutionManifest, cells: CellDef<any, any, any, any>[], layouts: LayoutMap = {}, opts: MakeServerOpts = {}) {
  return http.createServer(createHandler(manifest, cells, layouts, opts));
}
