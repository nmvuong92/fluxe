// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createI18n, translate, makeT, resolveLocale } from "./i18n.ts";

const i18n = createI18n({
  defaultLocale: "vi",
  catalogs: {
    vi: { "home.title": "Trang chủ", "hello": "Chào {name}", "only.vi": "chỉ vi" },
    en: { "home.title": "Home", "hello": "Hi {name}" },
  },
});

test("createI18n: locales suy từ catalogs, defaultLocale phải có", () => {
  assert.deepEqual(i18n.locales.sort(), ["en", "vi"]);
  assert.equal(i18n.defaultLocale, "vi");
  assert.throws(() => createI18n({ defaultLocale: "fr", catalogs: { vi: {} } }));
});

test("translate: tra đúng key theo locale", () => {
  assert.equal(translate(i18n, "en", "home.title"), "Home");
  assert.equal(translate(i18n, "vi", "home.title"), "Trang chủ");
});

test("translate: interpolate {var}", () => {
  assert.equal(translate(i18n, "en", "hello", { name: "Vương" }), "Hi Vương");
  assert.equal(translate(i18n, "vi", "hello", { name: "An" }), "Chào An");
  assert.equal(translate(i18n, "en", "hello", {}), "Hi {name}"); // thiếu var → giữ placeholder
});

test("translate: thiếu key ở locale → fallback defaultLocale → fallback key", () => {
  assert.equal(translate(i18n, "en", "only.vi"), "chỉ vi");          // en thiếu → vi
  assert.equal(translate(i18n, "en", "khong.co"), "khong.co");       // không đâu có → key
});

test("makeT: bind locale", () => {
  const t = makeT(i18n, "en");
  assert.equal(t("home.title"), "Home");
  assert.equal(t("hello", { name: "X" }), "Hi X");
});

test("resolveLocale: cookie hợp lệ thắng", () => {
  assert.equal(resolveLocale(i18n, { cookie: "en", acceptLanguage: "vi" }), "en");
  assert.equal(resolveLocale(i18n, { cookie: "fr" }), "vi");          // cookie sai → default
});

test("resolveLocale: Accept-Language (tag rồi base) khi không cookie", () => {
  assert.equal(resolveLocale(i18n, { acceptLanguage: "en-US,en;q=0.9" }), "en"); // base en
  assert.equal(resolveLocale(i18n, { acceptLanguage: "fr-FR,de;q=0.8,en;q=0.5" }), "en");
  assert.equal(resolveLocale(i18n, { acceptLanguage: "fr,de" }), "vi"); // không khớp → default
});

test("resolveLocale: không gì → defaultLocale", () => {
  assert.equal(resolveLocale(i18n, {}), "vi");
});
