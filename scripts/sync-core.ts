// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Quét các file "<name>.cell.tsx" trong app/frontend/features/<feature>/ → dữ liệu sinh registry
 * (cells[]+views[]). Convention: cell.id === basename của <name>.cell.tsx. Hàm thuần để test được. */
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface CellEntry { id: string; feature: string; hasView: boolean }

const ident = (id: string) => id.replace(/[^a-zA-Z0-9]/g, "_");

export function scanFeatures(root: string): CellEntry[] {
  const featuresDir = join(root, "features");
  if (!existsSync(featuresDir)) return [];
  const entries: CellEntry[] = [];
  for (const feat of readdirSync(featuresDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const dir = join(featuresDir, feat.name);
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".cell.tsx")).sort()) {
      const id = file.slice(0, -".cell.tsx".length);
      entries.push({ id, feature: feat.name, hasView: existsSync(join(dir, `${id}.view.tsx`)) });
    }
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/* registry.ts — CHỈ cells (server: route/loader/actions). resolve.ts + app.ts import file này. */
export function renderRegistry(entries: CellEntry[]): string {
  const imports = entries.map((e) => `import ${ident(e.id)}Cell from "./features/${e.feature}/${e.id}.cell";`).join("\n");
  const arr = entries.map((e) => `${ident(e.id)}Cell`).join(", ");
  return `// AUTO-GENERATED bởi fx sync — đừng sửa tay.
import type { CellDef } from "@nmvuong92/fluxe";
${imports}

export const cells: CellDef<any, any, any, any>[] = [${arr}];
`;
}

/* views.ts — CHỈ views (client bundle import file này → loader/actions/backend KHÔNG lọt browser). */
export function renderViews(entries: CellEntry[]): string {
  const withView = entries.filter((e) => e.hasView);
  const imports = withView.map((e) => `import ${ident(e.id)}View from "./features/${e.feature}/${e.id}.view";`).join("\n");
  const map = withView.map((e) => `  ${JSON.stringify(e.id)}: ${ident(e.id)}View,`).join("\n");
  return `// AUTO-GENERATED bởi fx sync — đừng sửa tay.
${imports}

export const views: Record<string, any> = {
${map}
};
`;
}
