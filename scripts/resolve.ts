// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { resolve as resolveManifest, type CellDecl } from "../src/core/resolver";

// cwd-relative: đọc file project (frontend/) qua dynamic import từ cwd → chạy cho mọi project.
const fromCwd = (rel: string) => import(pathToFileURL(join(process.cwd(), rel)).href);
const { profiles } = await fromCwd("frontend/profiles.ts");
const { cells: appCells } = await fromCwd("frontend/registry.ts");

const name = process.argv[2] ?? process.env.FLUXE_PROFILE ?? "dev";
const profile = profiles[name];
if (!profile) {
  console.error(`Profile không tồn tại: ${name}. Có: ${Object.keys(profiles).join(", ")}`);
  process.exit(1);
}

// Lấy thẳng từ app/app.ts — thêm cell ở đó là resolve tự thấy (không sửa script này).
const cells: CellDecl[] = appCells.map((c) => ({
  id: c.id,
  route: c.route,
  hydration: c.hydration,
}));

const manifest = resolveManifest(cells, profile);
mkdirSync(".fluxe", { recursive: true });
writeFileSync(".fluxe/resolution.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`[resolve] profile="${name}" → .fluxe/resolution.json`);
console.log(JSON.stringify(manifest, null, 2));
