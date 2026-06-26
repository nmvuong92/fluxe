#!/usr/bin/env bash
# Chứng minh switch backend: build + chạy service Go và Rust THẬT,
# rồi chạy proof_native.ts (cùng interface Backend) trên cả 3.
set -euo pipefail
cd "$(dirname "$0")"

GO_PORT=8081
RUST_PORT=8082
pids=()
cleanup() { for p in "${pids[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

echo "▸ Build service Rust (rustc -O)…"
rustc -O backends-native/rust/main.rs -o backends-native/rust/server

echo "▸ Start service Go   (go run .) trên :$GO_PORT"
( cd backends-native/go && PORT=$GO_PORT go run . ) & pids+=($!)

echo "▸ Start service Rust trên :$RUST_PORT"
PORT=$RUST_PORT backends-native/rust/server & pids+=($!)

echo "▸ Chờ 2 service sẵn sàng…"
for url in "http://127.0.0.1:$GO_PORT/health" "http://127.0.0.1:$RUST_PORT/health"; do
  for i in $(seq 1 50); do
    if curl -fsS "$url" >/dev/null 2>&1; then echo "  ok: $url"; break; fi
    sleep 0.2
  done
done

echo "▸ Chạy proof (Node chạy TS native)…"
GO_URL="http://127.0.0.1:$GO_PORT" RUST_URL="http://127.0.0.1:$RUST_PORT" \
  node --experimental-strip-types src/proof_native.ts
