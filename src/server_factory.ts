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
import { layouts } from "./layouts/index";
import { renderHead, renderSitemap, renderRobots } from "./core/seo.ts";
import { FluxeError, toErrorPayload, renderErrorPage } from "./core/errors.ts";
import { randomUUID } from "node:crypto";

const DEV = process.env.NODE_ENV !== "production";

function sendError(res: http.ServerResponse, wantsJson: boolean, err: unknown) {
  const errorId = randomUUID();
  const p = toErrorPayload(err, { dev: DEV, errorId });
  if (!(err instanceof FluxeError)) console.error(`[fluxe] unexpected ${errorId}:`, err);
  if (wantsJson) { res.writeHead(p.status, { "content-type": "application/json" }); res.end(JSON.stringify({ error: p })); }
  else { res.writeHead(p.status, { "content-type": "text/html; charset=utf-8" }); res.end(renderErrorPage(p)); }
}
import home from "./cells/home/index";
import todos from "./cells/todos/index";
import hello from "./cells/hello/index";

const cells: CellDef<any, any>[] = [home, todos, hello];
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
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    const wantsJson = req.headers["x-fluxe"] === "1" || url.searchParams.get("json") === "1";
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
    if (url.pathname.startsWith("/__action/") && req.method === "POST") {
      const [,,cellId,name] = url.pathname.split("/");
      const fn = byId.get(cellId)?.actions?.[name];
      if (!fn) { res.writeHead(404); return res.end("no action"); }
      const out = await fn({ input: JSON.parse((await readBody(req))||"{}"), backend: backendFor(cellId) });
      res.writeHead(200,{ "content-type":"application/json" }); return res.end(JSON.stringify(out));
    }
    const match = matchRoute(url.pathname);
    if (!match) { res.writeHead(404); return res.end("404"); }
    const cell = match.cell;
    const data = await cell.loader({ input: match.params, backend: backendFor(cell.id) });
    if (wantsJson) { res.writeHead(200,{ "content-type":"application/json" }); return res.end(JSON.stringify({ cell: cell.id, data })); }
    let node: any = h(cell.view, { data });
    for (const id of layoutChain(cell.layout, layouts)) {   // inner→outer: bọc dần
      node = h(layouts[id].component as any, { children: node });
    }
    const bodyHtml = renderToString(node);
    const shipClientJs = manifest.cells[cell.id]?.render.shipClientJs ?? false;
    res.writeHead(200,{ "content-type":"text/html; charset=utf-8" }); res.end(shell(cell, bodyHtml, data, shipClientJs));
    } catch (err) {
      // Error boundary ở biên request: domain → status/code; unexpected → 500 + errorId (không leak prod).
      sendError(res, wantsJson, err);
    }
  });
}
