#!/usr/bin/env bash
# PoC tầng realtime kiểu BEAM/OTP bằng Go: actor (1 room = 1 goroutine + mailbox) +
# supervisor (let-it-crash → restart). Quyết định: Go-actors mặc định, Elixir là plug-in.
set -euo pipefail
cd "$(dirname "$0")/app/native/actor-go"

echo "▸ go test -race (isolation + serial-no-race + supervision restart)"
go test -race ./...

echo
echo "▸ go run . (demo)"
go run .
