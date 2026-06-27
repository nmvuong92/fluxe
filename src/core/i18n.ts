// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* i18n — THUẦN, testable. Catalog message theo locale + t(key, vars) interpolate {var}.
 * resolveLocale: chọn locale từ cookie / Accept-Language, giới hạn trong locale có thật. */

export type Messages = Record<string, string>;
export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export interface I18n {
  locales: string[];
  defaultLocale: string;
  catalogs: Record<string, Messages>;
}

export function createI18n(opts: { defaultLocale: string; catalogs: Record<string, Messages> }): I18n {
  const locales = Object.keys(opts.catalogs);
  if (!locales.includes(opts.defaultLocale)) {
    throw new Error(`i18n: defaultLocale '${opts.defaultLocale}' không có trong catalogs`);
  }
  return { locales, defaultLocale: opts.defaultLocale, catalogs: opts.catalogs };
}

/* Tra key trong catalog locale → fallback defaultLocale → fallback chính key. Interpolate {var}. */
export function translate(i18n: I18n, locale: string, key: string, vars?: Record<string, string | number>): string {
  const msg = i18n.catalogs[locale]?.[key] ?? i18n.catalogs[i18n.defaultLocale]?.[key] ?? key;
  if (!vars) return msg;
  return msg.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/* t() đã bind locale — dùng trong loader/view. */
export function makeT(i18n: I18n, locale: string): TFn {
  return (key, vars) => translate(i18n, locale, key, vars);
}

/* Chọn locale: cookie hợp lệ > Accept-Language (khớp tag hoặc base) > defaultLocale. */
export function resolveLocale(i18n: I18n, opts: { cookie?: string; acceptLanguage?: string }): string {
  if (opts.cookie && i18n.locales.includes(opts.cookie)) return opts.cookie;
  if (opts.acceptLanguage) {
    for (const part of opts.acceptLanguage.split(",")) {
      const tag = part.split(";")[0].trim();        // "en-US"
      if (!tag) continue;
      if (i18n.locales.includes(tag)) return tag;
      const base = tag.split("-")[0];               // "en"
      if (i18n.locales.includes(base)) return base;
    }
  }
  return i18n.defaultLocale;
}
