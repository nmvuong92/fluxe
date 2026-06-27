// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx CLI — registry lệnh thuần (testable). bin/fx.ts dispatch + spawn. */

export interface Command {
  desc: string;
  shell: (args: string[]) => string;
}

const SYNC = "tsx scripts/sync.ts";   // auto-discovery: quét app/cells/* → app/app.ts
const ESBUILD = "esbuild src/client.tsx --bundle --format=esm --outfile=dist/client.js --jsx=automatic --loader:.tsx=tsx";
const p = (a: string[]) => a[0] ?? "dev"; // profile mặc định

export const COMMANDS: Record<string, Command> = {
  init: {
    desc: "Scaffold app/ mới (env, profiles, layout, cell home) — chỉ tạo file còn thiếu",
    shell: () => `tsx scripts/init.ts`,
  },
  new: {
    desc: "Tạo cell mới: fx new <id> [--island]  (auto-discovery tự đăng ký)",
    shell: (a) => `tsx scripts/new-cell.ts ${a.join(" ")}`,
  },
  sync: {
    desc: "Auto-discovery: quét app/cells/* → app/app.ts (dev/resolve tự gọi)",
    shell: () => SYNC,
  },
  config: {
    desc: "In config đã giải (default ← ENV FLUXE_* ← override)",
    shell: () => `tsx scripts/config.ts`,
  },
  resolve: {
    desc: "Sinh .fluxe/resolution.json từ profile",
    shell: (a) => `${SYNC} && tsx scripts/resolve.ts ${p(a)}`,
  },
  bench: {
    desc: "Benchmark RPS/QPS + latency p50/p99 + RAM/CPU",
    shell: (a) => `${SYNC} && tsx scripts/resolve.ts dev && npm run --silent build:client && tsx scripts/bench.ts ${a.join(" ")}`,
  },
  prerender: {
    desc: "Prerender cell static → .fluxe/static.json",
    shell: (a) => `${SYNC} && tsx scripts/prerender.ts ${p(a)}`,
  },
  build: {
    desc: "Build đầy đủ: sync + resolve + prerender + client bundle",
    shell: (a) => `${SYNC} && tsx scripts/resolve.ts ${p(a)} && tsx scripts/prerender.ts ${p(a)} && ${ESBUILD}`,
  },
  dev: {
    desc: "Sync + resolve + build client + chạy server",
    shell: (a) => `${SYNC} && tsx scripts/resolve.ts ${p(a)} && ${ESBUILD} && tsx scripts/dev.ts`,
  },
  test: {
    desc: "Sync + typecheck + unit + integration",
    shell: () => `${SYNC} && tsc --noEmit && node --experimental-sqlite --import tsx --test '{src,app}/**/*.test.ts' && tsx src/selftest2.ts`,
  },
};

export function renderUsage(): string {
  const lines = Object.entries(COMMANDS).map(([n, c]) => `  fx ${n.padEnd(10)} ${c.desc}`);
  return `fluxe CLI\n\nLệnh:\n${lines.join("\n")}\n`;
}
