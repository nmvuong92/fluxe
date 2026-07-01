// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Post-build: tsc `rewriteRelativeImportExtensions` sửa `.ts`→`.js` trong JS nhưng KHÔNG trong .d.ts
 * (giới hạn TS) → consumer không resolve được star export. Script này rewrite specifier tương đối
 * `"./x.ts"` → `"./x.js"` trong mọi file .d.ts dưới lib/. Portable (0 phụ thuộc sed GNU/BSD). */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".d.ts") ? [p] : [];
  });
}

let count = 0;
for (const file of walk("lib")) {
  const src = readFileSync(file, "utf8");
  const out = src.replace(/(from\s+"\.[^"]*?)\.ts"/g, '$1.js"');   // chỉ specifier tương đối (./ | ../)
  if (out !== src) { writeFileSync(file, out); count++; }
}
console.log(`[fix-dts] rewrote .ts→.js trong ${count} file .d.ts`);
