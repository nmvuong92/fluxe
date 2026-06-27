// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx dev runner — magic hot-reload:
 *  - server chạy với `tsx --watch` (tự restart khi file import-graph hoặc .fluxe/gen đổi).
 *  - watch app/ → đổi contract.ts / cell index/view → chạy `sync` (regen cells + contract codegen)
 *    → ghi app/app.ts + .fluxe/gen/* → tsx --watch thấy đổi → restart. Dev KHÔNG gõ gen tay.
 * (sync/resolve/bundle lần đầu đã chạy trước trong lệnh `fx dev`.) */
import { spawn } from "node:child_process";
import { watch } from "node:fs";

const NODE = ["--experimental-sqlite", "--import", "tsx"];
const run = (args: string[]) => spawn("node", [...NODE, ...args], { stdio: "inherit" });

run(["--watch", "app/backend/server.ts"]);   // server tự restart khi file đổi

let busy = false;
watch("app", { recursive: true }, (_e, file) => {
  if (!file || busy) return;
  if (file.endsWith("app.ts") || file.endsWith("views.ts")) return;          // file SINH RA → bỏ qua (tránh loop)
  if (!/contract\.ts$|index\.tsx?$|view\.tsx?$/.test(file)) return;           // chỉ source liên quan
  busy = true;
  console.log(`[dev] ${file} đổi → sync + codegen`);
  run(["scripts/sync.ts"]).on("exit", () => setTimeout(() => (busy = false), 300));
});
