import type { ResolutionManifest } from "./resolver.ts";

/* Panel RCA — render manifest thành HTML đọc-được (string builder thuần, testable).
 * Mầm của RCA Resolution view (Trục 4j/4n): cho thấy mỗi cell được giải trục nào. */
export function renderResolutionPanel(m: ResolutionManifest): string {
  const rows = Object.values(m.cells).map((c) => `
      <tr>
        <td><code>${c.id}</code></td>
        <td><code>${c.route}</code></td>
        <td>${c.render.mode}</td>
        <td>${c.render.shipClientJs ? "✓ JS" : "0 JS"}</td>
        <td><span class="badge ${c.backend.language}">${c.backend.language}</span></td>
        <td>${c.backend.transport}</td>
        <td>${c.backend.endpoint ?? "—"}</td>
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
  .badge{display:inline-block;padding:.1rem .55rem;border-radius:99px;font-size:.78rem}
  .go{background:#00add833;color:#5fd3f0}.rust{background:#dea58433;color:#e8b48f}.memory{background:#7c7cff33;color:#a0a0ff}
</style></head>
<body>
  <h1>RCA Resolution</h1>
  <div class="sub">profile <b>${m.profile}</b> · default backend <b>${m.backend.language}</b> (${m.backend.transport})</div>
  <table>
    <thead><tr><th>cell</th><th>route</th><th>render</th><th>JS</th><th>backend</th><th>transport</th><th>endpoint</th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>
  <p class="sub" style="margin-top:1.5rem">Đọc từ <code>.fluxe/resolution.json</code> — mỗi cell được Resolution Plane giải độc lập.</p>
</body></html>`;
}
