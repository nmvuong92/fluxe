---
title: CLI
description: fx CLI (bảng lệnh) + auto-discovery cell.
sidebar:
  order: 70
---

## Định nghĩa

`fx` là CLI của fluxe: scaffold app, tạo cell, codegen, resolve backend, build/dev, bench, test.
Registry lệnh (`COMMANDS`) là **thuần (testable)** — mỗi lệnh chỉ trả về một chuỗi shell; phần
dispatch lo spawn. Tách "lệnh nào → chạy gì" khỏi việc spawn → test được mà không chạy thật.

Một điểm cốt lõi: nhiều lệnh tự gọi `sync` (auto-discovery cell) trước → thêm trang chỉ cần tạo file
cell, không khai báo tay.

## Cơ chế trong fluxe

`COMMANDS` là một bảng `Record<string, Command>`, mỗi `Command` có `desc` (mô tả cho `fx help`) và
`shell(args)` trả về lệnh shell sẽ chạy. Vì lệnh chỉ là chuỗi nên có thể unit-test bằng so chuỗi mà
không spawn process thật. Khi gọi `fx <cmd>`, runtime tra `COMMANDS[cmd]`, dựng chuỗi rồi chạy; lệnh
lạ → in usage (`renderUsage()`) và thoát mã 1. Nhiều lệnh (`dev`/`resolve`/`build`/`test`) tự ghép
`sync` ở đầu để auto-discovery cell trước.

## Bảng lệnh

| Lệnh | Việc |
|------|------|
| `fx init` | Scaffold `app/` mới (env, profiles, layout, cell home) — chỉ tạo file còn thiếu |
| `fx new <id> [--island]` | Tạo cell mới từ template; auto-discovery tự đăng ký |
| `fx sync` | Quét `app/cells/*` → sinh `app/app.ts` + `app/views.ts` (dev/resolve tự gọi) |
| `fx resolve [profile]` | Sinh `.fluxe/resolution.json` từ profile |
| `fx prerender [profile]` | Prerender cell static → `.fluxe/static.json` |
| `fx build [profile]` | sync + resolve + prerender + bundle client |
| `fx dev [profile]` | sync + resolve + build client + chạy server |
| `fx jobs` | Demo job queue (enqueue + drain + dead-letter) |
| `fx bench [paths…]` | Benchmark RPS/QPS + p50/p99 + RAM/CPU |
| `fx test` | sync + typecheck + unit + integration |

## Ví dụ

```bash
fx init                # dựng app/ (env, profiles, layout, cell home)
fx new blog --island   # cell island mới → auto-discovery đăng ký
fx dev                 # sync + resolve + build client + chạy server (profile dev)
fx build sqlite        # build với profile sqlite
fx help                # in usage (renderUsage)
```

Profile mặc định là `dev` (hàm `p(a)` lấy `a[0] ?? "dev"`), nên `fx resolve` = `fx resolve dev`.

## Auto-discovery cell

`fx sync` quét `app/cells/<id>/index.ts(x)` và sinh **`app/app.ts`** (registry tĩnh) + `app/views.ts`
(registry view cho client bundle) — các file này **sinh tự động, đừng sửa tay**. Nó duyệt thư mục
`app/cells/*`, lấy mỗi cell có `index.ts(x)` rồi viết ra import tĩnh đã sắp xếp.

Vì là import **tĩnh** (không glob runtime) nên cả server (tsx) lẫn client bundle (esbuild) đều dùng
được. `dev` / `resolve` / `build` / `test` tự chạy `sync` trước → **thêm trang = `fx new <id>`** (hoặc
tự tạo file cell) rồi chạy lại, không khai báo tay.

## API

```ts
// @nmvuong92/fluxe
interface Command { desc: string; shell: (args: string[]) => string }
COMMANDS: Record<string, Command>      // init/new/sync/gen/resolve/prerender/build/dev/jobs/bench/test
renderUsage(): string                  // bảng lệnh in ra cho `fx help`
```

## Lưu ý

- `app/app.ts` + `app/views.ts` là **AUTO-GENERATED** — sửa tay sẽ bị `fx sync` ghi đè.
- Cell phải có `view.tsx` (cấu trúc 2-file: `index.tsx` = loader/actions, `view.tsx` = giao diện) →
  nhờ client chỉ import `view.tsx` nên loader/actions/zod/backend **không** bị bundle xuống browser.
  `sync` cảnh báo nếu thiếu `view.tsx`.
- `fx test` chạy `sync + tsc --noEmit + unit + integration` — đây là gate "xong" (tenet T4).
