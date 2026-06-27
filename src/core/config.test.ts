// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.ts";

test("default khi ENV rỗng", () => {
  const c = loadConfig({});
  assert.equal(c.env, "development");
  assert.equal(c.port, 5180);
  assert.equal(c.rateLimit.capacity, 30);
  assert.equal(c.rateLimit.maxKeys, 5000);
  assert.equal(c.renderCache.maxKeys, 256);
  assert.equal(c.upload.maxBytes, 10 * 1024 * 1024);
  assert.equal(c.defaultBackend, "memory");
});

test("ENV (FLUXE_*) override default", () => {
  const c = loadConfig({
    NODE_ENV: "production",
    FLUXE_SECRET: "a-strong-secret",
    FLUXE_RATELIMIT_CAPACITY: "99",
    FLUXE_UPLOAD_MAX_BYTES: "1048576",
    FLUXE_BACKEND: "sqlite",
    PORT: "8080",
  });
  assert.equal(c.env, "production");
  assert.equal(c.secret, "a-strong-secret");
  assert.equal(c.rateLimit.capacity, 99);
  assert.equal(c.rateLimit.refillPerSec, 10);   // không set → default
  assert.equal(c.upload.maxBytes, 1048576);
  assert.equal(c.defaultBackend, "sqlite");
  assert.equal(c.port, 8080);
});

test("override truyền tay THẮNG ENV", () => {
  const c = loadConfig({ FLUXE_RATELIMIT_CAPACITY: "99" }, { rateLimit: { capacity: 5 } });
  assert.equal(c.rateLimit.capacity, 5);
  assert.equal(c.rateLimit.maxKeys, 5000);       // phần khác giữ
});

test("PORT ưu tiên hơn FLUXE_PORT", () => {
  assert.equal(loadConfig({ PORT: "3000", FLUXE_PORT: "9000" }).port, 3000);
  assert.equal(loadConfig({ FLUXE_PORT: "9000" }).port, 9000);
});

test("sai kiểu → ném (fail-fast)", () => {
  assert.throws(() => loadConfig({ FLUXE_RATELIMIT_CAPACITY: "-5" }));   // âm
  assert.throws(() => loadConfig({ NODE_ENV: "staging" } as any));        // env không hợp lệ
  assert.throws(() => loadConfig({ FLUXE_SECRET: "short" }));             // secret < 8
});
