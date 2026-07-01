// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* openApiHandler(contract, opts) — node middleware (req,res,next) serve /openapi.json + /docs
 * (Swagger UI qua CDN). Mount TRƯỚC fluxe (host sở hữu route). 0 dep. */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contract } from "../core/contract.ts";
import { toOpenApi, type OpenApiOpts } from "./openapi.ts";

export interface ServeOpts extends OpenApiOpts { jsonPath?: string; docsPath?: string }

const swaggerHtml = (title: string, jsonPath: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css"></head>
<body><div id="swagger"></div>
<script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
<script>window.onload=()=>SwaggerUIBundle({url:${JSON.stringify(jsonPath)},dom_id:"#swagger"})</script>
</body></html>`;

export function openApiHandler(contract: Contract, opts: ServeOpts = {}) {
  const jsonPath = opts.jsonPath ?? "/openapi.json";
  const docsPath = opts.docsPath ?? "/docs";
  const doc = JSON.stringify(toOpenApi(contract, opts));
  const html = swaggerHtml(opts.title ?? "fluxe API", jsonPath);
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const path = (req.url ?? "").split("?")[0];
    if (path === jsonPath) { res.writeHead(200, { "content-type": "application/json" }); res.end(doc); return; }
    if (path === docsPath) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html); return; }
    next();
  };
}
