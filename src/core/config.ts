// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Config core — DEFAULT + override qua ENV (quy ước FLUXE_*), kiểu Laravel config().
 * Một nguồn sự thật cho mọi tham số tinh chỉnh của engine. Thứ tự ưu tiên:
 *   default  <  ENV (FLUXE_*)  <  override truyền tay.
 * Mọi giá trị quan trọng ĐỀU expose ra ENV + tài liệu (xem docs/reference/configuration). */
import { z } from "zod";

const Schema = z.object({
  env: z.enum(["development", "production", "test"]),
  port: z.coerce.number().int().positive(),
  renderCache: z.object({ maxKeys: z.coerce.number().int().positive() }),
  i18n: z.object({ defaultLocale: z.string().min(2) }),
});

export type FluxeConfig = z.infer<typeof Schema>;

type Src = Record<string, string | undefined>;

/* Bảng ENV — TÊN biến ↔ field. Dùng cho loadConfig + sinh tài liệu. */
export const ENV_KEYS = {
  "NODE_ENV": "env",
  "PORT (hoặc FLUXE_PORT)": "port",
  "FLUXE_RENDERCACHE_MAX_KEYS": "renderCache.maxKeys",
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
    renderCache: { ...base.renderCache, ...o.renderCache },
    i18n: { ...base.i18n, ...o.i18n },
  } as FluxeConfig;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

/* Giải config: default ← ENV (FLUXE_*) ← override. Validate Zod (sai → ném ngay, fail-fast). */
export function loadConfig(source: Src = process.env, overrides: DeepPartial<FluxeConfig> = {}): FluxeConfig {
  const fromEnv = {
    env: (source.NODE_ENV as FluxeConfig["env"]) || "development",
    port: num(source, "PORT", num(source, "FLUXE_PORT", 5180)),
    renderCache: { maxKeys: num(source, "FLUXE_RENDERCACHE_MAX_KEYS", 256) },
    i18n: { defaultLocale: source.FLUXE_LOCALE_DEFAULT || "en" },
  } as FluxeConfig;

  return Schema.parse(merge(fromEnv, overrides));
}
