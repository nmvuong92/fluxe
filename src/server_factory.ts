import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import type { CellDef } from "./core/engine";
import type { ResolutionManifest } from "./core/resolver";
import { backendsFromManifest } from "./core/wiring.ts";
import { renderResolutionPanel } from "./core/panel.ts";
import home from "./cells/home/index";
import todos from "./cells/todos/index";

const cells: CellDef<any, any>[] = [home, todos];
const byRoute = new Map(cells.map(c => [c.route, c]));
const byId = new Map(cells.map(c => [c.id, c]));

function shell(cell: CellDef<any, any>, bodyHtml: string, data: unknown, shipClientJs: boolean) {
  const island = shipClientJs
    ? `<script>window.__FLUXE__=${JSON.stringify({ cell: cell.id, data })};</script><script type="module" src="/client.js"></script>`
    : `<!-- static: 0 JS -->`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>fluxe</title></head><body><div id="root">${bodyHtml}</div>${island}</body></html>`;
}
const readBody = (req: http.IncomingMessage) => new Promise<string>(res => { let b=""; req.on("data",c=>b+=c); req.on("end",()=>res(b)); });

export function makeServer(manifest: ResolutionManifest) {
  // Backend GIẢI per-cell từ manifest (Resolution Plane) — cell/frontend giữ nguyên.
  const backends = backendsFromManifest(manifest);
  const backendFor = (id: string) => backends.byCell.get(id) ?? backends.default;
  return http.createServer(async (req, res) => {
    const url = new URL(req.url!, "http://localhost");
    if (url.pathname === "/client.js") {
      if (existsSync("./dist/client.js")) { res.writeHead(200,{ "content-type":"text/javascript" }); return res.end(readFileSync("./dist/client.js")); }
      res.writeHead(404); return res.end("// no client");
    }
    if (url.pathname === "/_fluxe") {
      // Panel RCA — đọc manifest, hiển thị mỗi cell giải trục nào. (Prod: gate sau auth.)
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(renderResolutionPanel(manifest));
    }
    if (url.pathname.startsWith("/__action/") && req.method === "POST") {
      const [,,cellId,name] = url.pathname.split("/");
      const fn = byId.get(cellId)?.actions?.[name];
      if (!fn) { res.writeHead(404); return res.end("no action"); }
      const out = await fn({ input: JSON.parse((await readBody(req))||"{}"), backend: backendFor(cellId) });
      res.writeHead(200,{ "content-type":"application/json" }); return res.end(JSON.stringify(out));
    }
    const cell = byRoute.get(url.pathname);
    if (!cell) { res.writeHead(404); return res.end("404"); }
    const data = await cell.loader({ input: {}, backend: backendFor(cell.id) });
    const wantsJson = req.headers["x-fluxe"] === "1" || url.searchParams.get("json") === "1";
    if (wantsJson) { res.writeHead(200,{ "content-type":"application/json" }); return res.end(JSON.stringify({ cell: cell.id, data })); }
    const bodyHtml = renderToString(h(cell.view, { data }));
    const shipClientJs = manifest.cells[cell.id]?.render.shipClientJs ?? false;
    res.writeHead(200,{ "content-type":"text/html; charset=utf-8" }); res.end(shell(cell, bodyHtml, data, shipClientJs));
  });
}
