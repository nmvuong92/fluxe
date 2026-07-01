// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx sync — auto-discovery cell. Quét "<name>.cell.tsx" trong app/frontend/features/<feature>/ →
 * sinh app/frontend/registry.ts (cells[] + views[]). Codegen tĩnh (không glob runtime). */
import { writeFileSync } from "node:fs";
import { scanFeatures, renderRegistry, renderViews } from "./sync-core.ts";

const ROOT = "frontend";   // cwd-relative: chạy từ thư mục project (cwd = app/ hoặc app2/…)
const entries = scanFeatures(ROOT);
writeFileSync(`${ROOT}/registry.ts`, renderRegistry(entries));   // cells (server)
writeFileSync(`${ROOT}/views.ts`, renderViews(entries));         // views (client)
const missing = entries.filter((e) => !e.hasView).map((e) => e.id);
console.log(`[sync] ${entries.length} cell → registry.ts + views.ts${missing.length ? ` ⚠ thiếu view: ${missing.join(", ")}` : ""}`);
