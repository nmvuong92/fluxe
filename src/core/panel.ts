// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { ResolutionManifest } from "./resolver.ts";
import type { ReqLog } from "./observe.ts";

const esc = (s: unknown) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* Dashboard fluxe (Trục 4j): RCA Resolution (mỗi cell giải trục nào) + Recent requests
 * (observe: timing/status). String builder thuần, testable. */
export function renderResolutionPanel(m: ResolutionManifest, requests: ReqLog[] = []): string {
  const rows = Object.values(m.cells).map((c) => `
      <tr>
        <td><code>${c.id}</code></td>
        <td><code>${c.route}</code></td>
        <td>${c.render.mode}</td>
        <td>${c.render.shipClientJs ? "✓ JS" : "0 JS"}</td>
      </tr>`).join("");

  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>fluxe — RCA Resolution</title>
<style>
  body{font:14px/1.5 ui-sans-serif,system-ui;margin:2rem;background:#0f0f1a;color:#e8e8f0}
  h1{font-size:1.3rem;margin:0 0 .2rem}
  .sub{color:#8a8aa0;margin-bottom:1.5rem}
  table{border-collapse:collapse;width:100%;max-width:920px}
  th,td{text-align:left;padding:.5rem .75rem;border-bottom:1px solid #2a2a40}
  th{color:#8a8aa0;font-weight:600;font-size:.78rem;text-transform:uppercase;letter-spacing:.04em}
  code{background:#1a1a2e;padding:.1rem .35rem;border-radius:4px;color:#a0a0ff}
</style></head>
<body>
  <h1>RCA Resolution</h1>
  <div class="sub">profile <b>${m.profile}</b> · data = backend user-owned (app/backend.ts)</div>
  <table>
    <thead><tr><th>cell</th><th>route</th><th>render</th><th>JS</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>
  <p class="sub" style="margin-top:1.5rem">Đọc từ <code>.fluxe/resolution.json</code> — mỗi cell được Resolution Plane giải độc lập.</p>
  ${requests.length ? `
  <h1 style="font-size:1.1rem;margin:2rem 0 .2rem">Recent requests</h1>
  <div class="sub">${requests.length} request gần nhất (observe)</div>
  <table>
    <thead><tr><th>method</th><th>path</th><th>status</th><th>ms</th></tr></thead>
    <tbody>${requests.map((r) => `
      <tr><td>${esc(r.method)}</td><td><code>${esc(r.path)}</code></td><td>${r.status}</td><td>${r.ms}ms</td></tr>`).join("")}
    </tbody>
  </table>` : ""}
</body></html>`;
}
