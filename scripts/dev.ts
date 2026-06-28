// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx dev runner — hot-reload:
 *  - server chạy với `tsx --watch` (tự restart khi file import-graph đổi — gồm app/contract.ts).
 *  - watch app/ → thêm/bớt cell (index/view) → chạy `sync` (regen app/app.ts) → tsx --watch restart.
 * Contract dùng builder (0 codegen) → đổi contract.ts là tsx --watch restart ngay, không cần gen.
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
  // index.tsx = entry cell (route/hydration/layout) → ĐỔI MANIFEST → phải `resolve` (sync + manifest),
  // không chỉ `sync`; nếu không, cell mới SSR được nhưng hydration sai (vd island không ship JS).
  const cellEntry = /cells\/[^/]+\/index\.tsx?$/.test(file.replace(/\\/g, "/"));
  console.log(`[dev] ${file} đổi → ${cellEntry ? "resolve (sync + manifest)" : "sync"}`);
  const done = () => setTimeout(() => (busy = false), 300);
  run(["scripts/sync.ts"]).on("exit", () => (cellEntry ? run(["scripts/resolve.ts"]).on("exit", done) : done()));
});
