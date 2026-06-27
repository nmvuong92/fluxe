// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Config core — DEFAULT + override qua ENV (quy ước FLUXE_*), kiểu Laravel config().
 * Một nguồn sự thật cho mọi tham số tinh chỉnh của engine. Thứ tự ưu tiên:
 *   default  <  ENV (FLUXE_*)  <  override truyền tay.
 * Mọi giá trị quan trọng ĐỀU expose ra ENV + tài liệu (xem docs/reference/configuration). */
import { z } from "zod";

const Schema = z.object({
  env: z.enum(["development", "production", "test"]),
  secret: z.string().min(8),
  port: z.coerce.number().int().positive(),
  defaultBackend: z.enum(["memory", "go", "rust"]),
  rateLimit: z.object({
    capacity: z.coerce.number().int().positive(),
    refillPerSec: z.coerce.number().positive(),
    maxKeys: z.coerce.number().int().positive(),
  }),
  renderCache: z.object({ maxKeys: z.coerce.number().int().positive() }),
  upload: z.object({ maxBytes: z.coerce.number().int().positive() }),
  i18n: z.object({ defaultLocale: z.string().min(2) }),
});

export type FluxeConfig = z.infer<typeof Schema>;

type Src = Record<string, string | undefined>;

/* Bảng ENV — TÊN biến ↔ field. Dùng cho loadConfig + sinh tài liệu. */
export const ENV_KEYS = {
  "NODE_ENV": "env",
  "FLUXE_SECRET": "secret",
  "PORT (hoặc FLUXE_PORT)": "port",
  "FLUXE_BACKEND": "defaultBackend",
  "FLUXE_RATELIMIT_CAPACITY": "rateLimit.capacity",
  "FLUXE_RATELIMIT_REFILL": "rateLimit.refillPerSec",
  "FLUXE_RATELIMIT_MAX_KEYS": "rateLimit.maxKeys",
  "FLUXE_RENDERCACHE_MAX_KEYS": "renderCache.maxKeys",
  "FLUXE_UPLOAD_MAX_BYTES": "upload.maxBytes",
  "FLUXE_LOCALE_DEFAULT": "i18n.defaultLocale",
} as const;

const num = (s: Src, k: string, d: number) => {
  const v = s[k];
  return v == null || v === "" ? d : Number(v);
};

function merge(base: FluxeConfig, o: DeepPartial<FluxeConfig>): FluxeConfig {
  return {
    ...base,
    ...o,
    rateLimit: { ...base.rateLimit, ...o.rateLimit },
    renderCache: { ...base.renderCache, ...o.renderCache },
    upload: { ...base.upload, ...o.upload },
    i18n: { ...base.i18n, ...o.i18n },
  } as FluxeConfig;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/* Giải config: default ← ENV (FLUXE_*) ← override. Validate Zod (sai → ném ngay, fail-fast). */
export function loadConfig(source: Src = process.env, overrides: DeepPartial<FluxeConfig> = {}): FluxeConfig {
  const fromEnv = {
    env: (source.NODE_ENV as FluxeConfig["env"]) || "development",
    secret: source.FLUXE_SECRET || "dev-secret-change-me",
    port: num(source, "PORT", num(source, "FLUXE_PORT", 5180)),
    defaultBackend: (source.FLUXE_BACKEND as FluxeConfig["defaultBackend"]) || "memory",
    rateLimit: {
      capacity: num(source, "FLUXE_RATELIMIT_CAPACITY", 30),
      refillPerSec: num(source, "FLUXE_RATELIMIT_REFILL", 10),
      maxKeys: num(source, "FLUXE_RATELIMIT_MAX_KEYS", 5000),
    },
    renderCache: { maxKeys: num(source, "FLUXE_RENDERCACHE_MAX_KEYS", 256) },
    upload: { maxBytes: num(source, "FLUXE_UPLOAD_MAX_BYTES", 10 * 1024 * 1024) },
    i18n: { defaultLocale: source.FLUXE_LOCALE_DEFAULT || "en" },
  } as FluxeConfig;

  return Schema.parse(merge(fromEnv, overrides));
}
