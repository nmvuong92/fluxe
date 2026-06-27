// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.ts";

test("default khi ENV rỗng", () => {
  const c = loadConfig({});
  assert.equal(c.env, "development");
  assert.equal(c.port, 5180);
  assert.equal(c.renderCache.maxKeys, 256);
  assert.equal(c.i18n.defaultLocale, "en");
});

test("ENV (FLUXE_*) override default", () => {
  const c = loadConfig({
    NODE_ENV: "production",
    FLUXE_RENDERCACHE_MAX_KEYS: "512",
    FLUXE_LOCALE_DEFAULT: "vi",
    PORT: "8080",
  });
  assert.equal(c.env, "production");
  assert.equal(c.renderCache.maxKeys, 512);
  assert.equal(c.i18n.defaultLocale, "vi");
  assert.equal(c.port, 8080);
});

test("override truyền tay THẮNG ENV", () => {
  const c = loadConfig({ FLUXE_RENDERCACHE_MAX_KEYS: "99" }, { renderCache: { maxKeys: 5 } });
  assert.equal(c.renderCache.maxKeys, 5);
});

test("PORT ưu tiên hơn FLUXE_PORT", () => {
  assert.equal(loadConfig({ PORT: "3000", FLUXE_PORT: "9000" }).port, 3000);
  assert.equal(loadConfig({ FLUXE_PORT: "9000" }).port, 9000);
});

test("sai kiểu → ném (fail-fast)", () => {
  assert.throws(() => loadConfig({ FLUXE_RENDERCACHE_MAX_KEYS: "-5" }));   // âm
  assert.throws(() => loadConfig({ NODE_ENV: "staging" } as any));        // env không hợp lệ
});
