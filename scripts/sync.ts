// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx sync — auto-discovery cell. Quét app/cells/<id>/index.ts(x) → sinh app/app.ts.
 * Nhờ codegen tĩnh (không glob runtime), cả server (tsx) lẫn client (esbuild) đều import
 * được app/app.ts như thường. Thêm trang = tạo file cell, chạy lại — KHÔNG khai báo tay. */
import { readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CELLS_DIR = "app/cells";

// Mỗi thư mục con có index.ts hoặc index.tsx = một cell. Sắp xếp để output ổn định.
const dirs = readdirSync(CELLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((name) => existsSync(join(CELLS_DIR, name, "index.ts")) || existsSync(join(CELLS_DIR, name, "index.tsx")))
  .sort();

// Tên biến import an toàn (folder → identifier hợp lệ).
const ident = (name: string) => "c_" + name.replace(/[^A-Za-z0-9_$]/g, "_");

const importLines = dirs.map((d) => `import ${ident(d)} from "./cells/${d}/index";`).join("\n");
const arrayBody = dirs.map(ident).join(", ");

const out = `// ⚠️ AUTO-GENERATED bởi \`fx sync\` (quét ${CELLS_DIR}/*). ĐỪNG sửa tay.
// Thêm trang = tạo app/cells/<id>/index.tsx rồi chạy \`fx sync\` (dev/resolve tự gọi).
import type { CellDef } from "../src/core/engine";
${importLines}

export const cells: CellDef<any, any>[] = [${arrayBody}];
`;

writeFileSync("app/app.ts", out);

// app/views.ts — registry CHỈ-VIEW cho CLIENT bundle (import default từ view.tsx).
// Nhờ client chỉ import file này (không import index.tsx) → loader/actions/zod/backend
// KHÔNG bị bundle xuống browser. Cell phải có view.tsx (đúng cấu trúc 2-file).
const withView = dirs.filter((d) => existsSync(join(CELLS_DIR, d, "view.tsx")));
const missing = dirs.filter((d) => !existsSync(join(CELLS_DIR, d, "view.tsx")));
const viewImports = withView.map((d) => `import ${ident(d)} from "./cells/${d}/view";`).join("\n");
const viewMap = withView.map((d) => `  "${d}": ${ident(d)},`).join("\n");

const viewsOut = `// ⚠️ AUTO-GENERATED bởi \`fx sync\`. ĐỪNG sửa tay. Registry view cho CLIENT (chỉ giao diện).
import type { ComponentType } from "react";
${viewImports}

export const views: Record<string, ComponentType<{ data: any }>> = {
${viewMap}
};
`;

writeFileSync("app/views.ts", viewsOut);
console.log(`[sync] ${dirs.length} cell → app/app.ts + app/views.ts (${withView.length} view)${missing.length ? ` ⚠ thiếu view.tsx: ${missing.join(", ")}` : ""}`);

// Auto-gen contract (magic — dev không gõ `fx gen` tay). Bỏ qua nếu app chưa có contract.
if (existsSync("app/contract.ts")) {
  try {
    const { execSync } = await import("node:child_process");
    execSync("node --experimental-sqlite --import tsx scripts/codegen.ts", { stdio: "inherit" });
  } catch (e) { console.warn("[sync] contract codegen bỏ qua:", (e as Error).message); }
}
