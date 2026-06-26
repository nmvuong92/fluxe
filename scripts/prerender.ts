/* Prerender cell `static` → HTML build sẵn (0 JS) cho Go host phục vụ trực tiếp.
 * Theo §6d: "cell static → Go phục vụ HTML build sẵn". Xuất .fluxe/static.json (route→html). */
import { writeFileSync, mkdirSync } from "node:fs";
import { renderToString } from "react-dom/server";
import { createElement as h } from "react";
import { resolve, type CellDecl } from "../src/core/resolver";
import { backendFromManifest } from "../src/core/wiring";
import { renderHead } from "../src/core/seo";
import { profiles } from "../src/profiles";
import home from "../src/cells/home/index";
import todos from "../src/cells/todos/index";
import hello from "../src/cells/hello/index";

const allCells = [home, todos, hello];
const profileName = process.argv[2] ?? process.env.FLUXE_PROFILE ?? "dev";
const decls: CellDecl[] = allCells.map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));
const manifest = resolve(decls, profiles[profileName]);

const out: Record<string, string> = {};
for (const cell of allCells) {
  const r = manifest.cells[cell.id];
  if (r.render.mode !== "static") continue;   // chỉ prerender static
  if (cell.route.includes("[")) continue;      // bỏ route động (cần param runtime)
  const backend = backendFromManifest({ ...manifest, backend: r.backend });
  const data = await cell.loader({ input: {}, backend });
  const body = renderToString(h(cell.view, { data }));
  const headHtml = renderHead(cell.head ? cell.head(data) : {});
  out[cell.route] =
    `<!doctype html><html lang="vi"><head><meta charset="utf-8">${headHtml}</head>` +
    `<body><div id="root">${body}</div><!-- prerendered static: 0 JS --></body></html>`;
}

mkdirSync(".fluxe", { recursive: true });
writeFileSync(".fluxe/static.json", JSON.stringify(out));
console.log(`[prerender] profile="${profileName}" → ${Object.keys(out).length} static route(s): ${Object.keys(out).join(", ")}`);
