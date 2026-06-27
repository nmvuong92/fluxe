// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Benchmark harness fluxe — RPS/QPS + latency p50/p99 + RAM/CPU của server.
 * Closed-loop: N worker đồng thời bắn liên tục trong D giây. Loại DB (memory backend).
 * Server chạy child process riêng → /_fluxe/stats báo RAM/CPU chính nó. */
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.BENCH_PORT) || 5191;
const DURATION_MS = Number(process.env.BENCH_MS) || 4000;
const CONCURRENCY = Number(process.env.BENCH_CONC) || 50;
const PATHS = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/todos?json=1"];

const get = (path: string): Promise<number> =>
  new Promise((resolve) => {
    const t = performance.now();
    const r = http.get({ host: "127.0.0.1", port: PORT, path }, (res) => {
      res.resume();
      res.on("end", () => resolve(performance.now() - t));
    });
    r.on("error", () => resolve(-1));
  });

const stats = (): Promise<any> =>
  new Promise((resolve, reject) => {
    const r = http.get({ host: "127.0.0.1", port: PORT, path: "/_fluxe/stats" }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve(JSON.parse(b)));
    });
    r.on("error", reject);
  });

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function benchPath(path: string) {
  const lat: number[] = [];
  let errors = 0;
  const before = await stats();
  const t0 = performance.now();
  const deadline = t0 + DURATION_MS;
  async function worker() {
    while (performance.now() < deadline) {
      const ms = await get(path);
      if (ms < 0) errors++; else lat.push(ms);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const wall = (performance.now() - t0) / 1000;
  const after = await stats();

  lat.sort((a, b) => a - b);
  const rps = Math.round(lat.length / wall);
  const cpuPct = Math.round(((after.cpuUser + after.cpuSystem - before.cpuUser - before.cpuSystem) / 1e6 / wall) * 100);
  console.log(`\n  ── ${path} ──`);
  console.log(`  RPS:        ${rps.toLocaleString()}  (${lat.length} req / ${wall.toFixed(1)}s, conc ${CONCURRENCY})`);
  console.log(`  latency:    p50 ${pct(lat, 50).toFixed(2)}ms · p99 ${pct(lat, 99).toFixed(2)}ms · max ${pct(lat, 100).toFixed(2)}ms`);
  console.log(`  errors:     ${errors}`);
  console.log(`  server RAM: RSS ${(after.rss / 1048576).toFixed(1)} MB · heap ${(after.heapUsed / 1048576).toFixed(1)} MB`);
  console.log(`  server CPU: ~${cpuPct}% (1 lõi = 100%) trong lúc bench`);
}

async function waitReady() {
  for (let i = 0; i < 100; i++) {
    try { await stats(); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("server không sẵn sàng");
}

async function main() {
  console.log(`▸ start server (Node SSR) :${PORT}`);
  const srv = spawn("npx", ["tsx", "src/server.tsx"], { env: { ...process.env, PORT: String(PORT) }, stdio: "ignore" });
  try {
    await waitReady();
    // warm-up
    await Promise.all(Array.from({ length: 200 }, () => get(PATHS[0])));
    console.log(`▸ bench ${DURATION_MS}ms/path, concurrency ${CONCURRENCY} (loại DB — memory backend)`);
    for (const p of PATHS) await benchPath(p);
    console.log("\n→ Đây là benchmark Node SSR tier. Static prerender (Go host) sẽ cao hơn nhiều cho cell static.");
  } finally {
    srv.kill();
  }
}
main();
