// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { definePlugin } from "./plugin.ts";

test("definePlugin ném khi thiếu name", () => {
  assert.throws(() => definePlugin({} as any), /name/);
});

test("definePlugin ném khi apiVersion không hỗ trợ", () => {
  assert.throws(() => definePlugin({ name: "@fluxe/x", apiVersion: 99 } as any), /apiVersion/);
});

test("definePlugin mặc định apiVersion = 1", () => {
  assert.equal(definePlugin({ name: "@fluxe/x" }).apiVersion, 1);
});
