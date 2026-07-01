// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx new <feature>/<name> [--static] — scaffold cell trong app/frontend/features/<feature>/:
 *   <name>.view.tsx  = giao diện thuần (React component + kiểu data)
 *   <name>.cell.tsx  = cell: route/hydration/layout/loader/head, gắn view
 * Dạng ngắn `fx new <name>` → feature = name. Sau đó sync (auto-discovery). Mặc định island; --static = 0-JS. */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const isStatic = args.includes("--static");
const raw = args.find((a) => !a.startsWith("--"));

if (!raw || !/^[a-z][a-z0-9-]*(\/[a-z][a-z0-9-]*)?$/.test(raw)) {
  console.error("Dùng: fx new <feature>/<name> [--static]   (hoặc `fx new <name>`; chữ thường)");
  process.exit(1);
}
const [feature, nameOpt] = raw.includes("/") ? raw.split("/") : [raw, raw];
const name = nameOpt;
const dir = join("app/frontend/features", feature);
const cellPath = join(dir, `${name}.cell.tsx`);
const viewPath = join(dir, `${name}.view.tsx`);
if (existsSync(cellPath)) { console.error(`Cell '${name}' đã tồn tại: ${cellPath}`); process.exit(1); }

const Comp = name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());   // lot-detail → LotDetail

const staticView = `// ${name}.view.tsx — GIAO DIỆN thuần (0 server logic).
export interface ${Comp}Data { title: string }

export function ${Comp}({ data }: { data: ${Comp}Data }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p>Trang static — 0 JS.</p>
    </div>
  );
}

export default ${Comp};
`;

const staticCell = `// ${name}.cell.tsx — CELL: route + loader (server), gắn view.
import { defineCell } from "@nmvuong92/fluxe";
import { ${Comp} } from "./${name}.view";

export default defineCell({
  id: "${name}",
  route: "/${name}",
  hydration: "static",
  layout: "site",
  async loader() { return { title: "${Comp}" }; },
  head: (data) => ({ title: data.title }),
  view: ${Comp},
});
`;

const islandView = `// ${name}.view.tsx — GIAO DIỆN island (interactive: state client).
import { useState } from "react";

export interface ${Comp}Data { title: string }

export function ${Comp}({ data }: { data: ${Comp}Data }) {
  const [n, setN] = useState(0);
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <button onClick={() => setN(n + 1)}>Đã bấm {n} lần</button>
    </div>
  );
}

export default ${Comp};
`;

const islandCell = `// ${name}.cell.tsx — CELL: route + loader (server), gắn view (hydration mặc định island).
import { defineCell } from "@nmvuong92/fluxe";
import { ${Comp} } from "./${name}.view";

export default defineCell({
  id: "${name}",
  route: "/${name}",
  layout: "site",
  async loader() { return { title: "${Comp}" }; },
  head: (data) => ({ title: data.title }),
  view: ${Comp},
});
`;

mkdirSync(dir, { recursive: true });
writeFileSync(viewPath, isStatic ? staticView : islandView);
writeFileSync(cellPath, isStatic ? staticCell : islandCell);
console.log(`[new] tạo ${cellPath} + ${viewPath} (${isStatic ? "static" : "island"})`);
execSync("npm run sync", { stdio: "inherit" });   // auto-discovery đăng ký ngay (npm resolve tsx)
console.log(`→ Chạy: npm run dev   rồi mở  http://localhost:5180/${name}`);
