#!/usr/bin/env bash
# Chứng minh hot-path RUST (§6d: Rust cho compute CPU-bound) sau một biên riêng.
set -euo pipefail
cd "$(dirname "$0")"

PORT=8083
pids=()
cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

echo "▸ build Rust hot-path (rustc -O)…"
rustc -O backends-native/hot-rust/main.rs -o backends-native/hot-rust/server

echo "▸ start Rust search :$PORT"
PORT=$PORT backends-native/hot-rust/server >/tmp/fluxe-hot.log 2>&1 & pids+=($!)

for i in $(seq 1 50); do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && break; sleep 0.2; done

echo "▸ gọi qua adapter TS (Node)…"
RUST_HOT="http://127.0.0.1:$PORT" node --import tsx -e '
import { createRustSearch } from "./src/hot/search.ts";
const svc = createRustSearch(process.env.RUST_HOT);
const items = ["Học kiến trúc fullstack","Dựng PoC switch backend","backend polyglot Go Rust","frontend island 0 JS","backend backend backend"];
const hits = await svc.search(items, "backend");
console.log("query=\"backend\" → ranking (Rust compute):");
for (const h of hits) console.log(`  [${h.score}] ${h.item}`);
const ok = hits.length === 3 && hits[0].item === "backend backend backend" && hits[0].score === 3;
console.log(ok ? "✓ ranking đúng (nhiều khớp nhất lên đầu)" : "✗ ranking sai");
process.exit(ok ? 0 : 1);
'
echo "→ Compute (search ranking) chạy ở RUST, TS chỉ gọi qua biên. Đúng §6d hot-path."
