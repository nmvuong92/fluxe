// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx dev runner — hot-reload:
 *  - server chạy với `tsx --watch` (tự restart khi file import-graph đổi — gồm app/contract.ts).
 *  - watch app/ → thêm/bớt cell (index/view) → chạy `sync` (regen app/app.ts) → tsx --watch restart.
 * Contract dùng builder (0 codegen) → đổi contract.ts là tsx --watch restart ngay, không cần gen.
 * (sync/resolve/bundle lần đầu đã chạy trước trong lệnh `fx dev`.) */
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const NODE = ["--experimental-sqlite", "--import", "tsx"];
const run = (args: string[]) => spawn("node", [...NODE, ...args], { stdio: "inherit" });
const SCRIPTS = dirname(fileURLToPath(import.meta.url));   // thư mục scripts/ của engine (chạy cwd=project)
const engine = (f: string) => join(SCRIPTS, f);

run(["--watch", "backend/server.ts"]);   // cwd-relative: server của project tự restart khi file đổi

let busy = false;
watch(".", { recursive: true }, (_e, file) => {
  if (!file || busy) return;
  if (file.endsWith("registry.ts")) return;                                   // file SINH RA → bỏ qua (tránh loop)
  if (!/\.(cell|view|contract|resolvers|plugin|service)\.tsx?$/.test(file)) return;   // chỉ source liên quan
  busy = true;
  // *.cell.tsx = entry cell (route/hydration/layout) → ĐỔI MANIFEST → phải `resolve` (sync + manifest),
  // không chỉ `sync`; nếu không, cell mới SSR được nhưng hydration sai (vd island không ship JS).
  const cellEntry = /\.cell\.tsx$/.test(file.replace(/\\/g, "/"));
  console.log(`[dev] ${file} đổi → ${cellEntry ? "resolve (sync + manifest)" : "sync"}`);
  const done = () => setTimeout(() => (busy = false), 300);
  run([engine("sync.ts")]).on("exit", () => (cellEntry ? run([engine("resolve.ts")]).on("exit", done) : done()));
});
