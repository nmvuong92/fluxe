// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx CLI — registry lệnh thuần (testable). bin/fx.ts dispatch + spawn. */

export interface Command {
  desc: string;
  shell: (args: string[]) => string;
}

const p = (a: string[]) => a[0] ?? "dev"; // profile mặc định
const ESBUILD = "esbuild frontend/client.tsx --bundle --format=esm --outfile=dist/client.js --jsx=automatic --loader:.tsx=tsx";

/* Lệnh fx — cwd-relative (chạy từ thư mục project). `pkg` = engine root để trỏ scripts/ đúng chỗ
 * dù cwd là app/ hay app2/… (bin/fx.ts truyền đường dẫn tuyệt đối của package). */
export function makeCommands(pkg: string): Record<string, Command> {
  const S = (f: string) => `tsx ${pkg}/scripts/${f}`;
  const SYNC = S("sync.ts");   // quét frontend/features/*.cell.tsx → frontend/registry.ts + views.ts
  return {
    init: { desc: "Scaffold project mới (backend/frontend feature-module) — chỉ tạo file còn thiếu", shell: (a) => `${S("init.ts")} ${a.join(" ")}` },
    new: { desc: "Tạo cell mới: fx new <feature>/<name> [--static]", shell: (a) => `${S("new-cell.ts")} ${a.join(" ")}` },
    sync: { desc: "Auto-discovery: quét frontend/features/* → registry.ts + views.ts", shell: () => SYNC },
    config: { desc: "In config đã giải (default ← ENV FLUXE_* ← override)", shell: () => S("config.ts") },
    openapi: { desc: "Sinh .fluxe/openapi.json + collection Bruno (bruno/) từ contract", shell: (a) => `${S("openapi.ts")} ${a.join(" ")}` },
    resolve: { desc: "Sinh .fluxe/resolution.json từ profile", shell: (a) => `${SYNC} && ${S("resolve.ts")} ${p(a)}` },
    bench: { desc: "Benchmark RPS/QPS + latency + RAM/CPU", shell: (a) => `${SYNC} && ${S("resolve.ts")} dev && ${ESBUILD} && ${S("bench.ts")} ${a.join(" ")}` },
    prerender: { desc: "Prerender cell static → .fluxe/static.json", shell: (a) => `${SYNC} && ${S("prerender.ts")} ${p(a)}` },
    build: { desc: "Build đầy đủ: sync + resolve + prerender + client bundle", shell: (a) => `${SYNC} && ${S("resolve.ts")} ${p(a)} && ${S("prerender.ts")} ${p(a)} && ${ESBUILD}` },
    dev: { desc: "Sync + resolve + build client + chạy server (watch)", shell: (a) => `${SYNC} && ${S("resolve.ts")} ${p(a)} && ${ESBUILD} && ${S("dev.ts")}` },
    test: { desc: "Sync + typecheck + unit + integration", shell: () => `${SYNC} && tsc --noEmit && node --experimental-sqlite --import tsx --test 'backend/**/*.test.ts'` },
  };
}

export const COMMANDS: Record<string, Command> = makeCommands(".");

export function renderUsage(): string {
  const lines = Object.entries(COMMANDS).map(([n, c]) => `  fx ${n.padEnd(10)} ${c.desc}`);
  return `fluxe CLI\n\nLệnh:\n${lines.join("\n")}\n`;
}
