---
title: Configuration (ENV)
description: Cấu hình mọi tính năng core qua ENV (FLUXE_*) — default ← ENV ← override, kiểu Laravel.
sidebar:
  order: 1
---

## Định nghĩa

Mọi tham số tinh chỉnh của engine có **default hợp lý**, override được qua **biến môi trường**
(`FLUXE_*`) hoặc truyền tay. Thứ tự ưu tiên (như Laravel `config()` + `.env`):

```
default  <  ENV (FLUXE_*)  <  override truyền tay (makeServer({ config }))
```

`loadConfig()` giải + **validate (Zod)** — sai kiểu/giá trị → ném ngay lúc boot (fail-fast).

```ts
import { makeServer, loadConfig } from "@nmvuong92/fluxe";

makeServer(manifest, cells, layouts, {
  config: loadConfig(process.env, { upload: { maxBytes: 50 * 1024 * 1024 } }),  // override 50MB
}).listen();
// hoặc bỏ qua → makeServer tự loadConfig() từ ENV.
```

Xem config đã giải: `fx config` (như `artisan config:show`).

## Toàn bộ biến ENV (per-feature)

| Tính năng | Biến ENV | Field | Default |
|-----------|----------|-------|---------|
| **App** | `NODE_ENV` | `env` | `development` |
| | `FLUXE_SECRET` | `secret` | `dev-secret-change-me` (đổi ở prod!) |
| | `PORT` (hoặc `FLUXE_PORT`) | `port` | `5180` |
| **Rate limit** | `FLUXE_RATELIMIT_CAPACITY` | `rateLimit.capacity` | `30` |
| | `FLUXE_RATELIMIT_REFILL` | `rateLimit.refillPerSec` | `10` |
| | `FLUXE_RATELIMIT_MAX_KEYS` | `rateLimit.maxKeys` | `5000` |
| **Render cache** | `FLUXE_RENDERCACHE_MAX_KEYS` | `renderCache.maxKeys` | `256` |
| **Upload** | `FLUXE_UPLOAD_MAX_BYTES` | `upload.maxBytes` | `10485760` (10MB) |
| **i18n** | `FLUXE_LOCALE_DEFAULT` | `i18n.defaultLocale` | `en` |

> App-level env riêng của bạn (DB url, mail key…) khai báo ở `app/env.ts` với `loadEnv(zod)` —
> validate fail-fast lúc boot. Xem [Env](/reference/env/).

## Quy tắc (BẮT BUỘC khi thêm tính năng)

1. **Mọi tham số quan trọng → expose ra ENV** (`FLUXE_<FEATURE>_<PARAM>`), có default, vào `loadConfig`.
2. **Validate** bằng Zod trong config schema (fail-fast).
3. **Tài liệu** biến đó vào bảng trên + trang reference của tính năng.
4. Engine đọc từ `config`, **không hardcode** số trong code.

## API

```ts
loadConfig(source = process.env, overrides?): FluxeConfig    // giải + validate
type FluxeConfig = {
  env; secret; port;
  rateLimit: { capacity; refillPerSec; maxKeys };
  renderCache: { maxKeys };
  upload: { maxBytes };
  i18n: { defaultLocale };
};
ENV_KEYS   // map biến ENV → field (dùng cho fx config + docs)
```

## Ví dụ `.env` (prod)

```bash
NODE_ENV=production
FLUXE_SECRET=$(openssl rand -hex 32)
PORT=8080
DATABASE_URL=postgres://user:pass@10.0.0.5:5432/app   # env của app bạn, đọc trong app/backend/data.ts
FLUXE_RATELIMIT_CAPACITY=100
FLUXE_UPLOAD_MAX_BYTES=52428800
```
Node nạp `.env`: `node --env-file=.env …` (Node 20.6+), hoặc `tsx --env-file=.env`.
