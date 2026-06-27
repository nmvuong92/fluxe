// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderResolutionPanel } from "./panel.ts";
import type { ResolutionManifest } from "./resolver.ts";

const mixed: ResolutionManifest = {
  version: 1, profile: "mixed",
  cells: {
    home: { id: "home", route: "/", render: { mode: "static", shipClientJs: false } },
    todos: { id: "todos", route: "/todos", render: { mode: "island", shipClientJs: true } },
  },
};

test("panel hiển thị tiêu đề + profile", () => {
  const html = renderResolutionPanel(mixed);
  assert.match(html, /RCA Resolution/);
  assert.match(html, /mixed/);
});

test("panel có hàng per-cell với render mode", () => {
  const html = renderResolutionPanel(mixed);
  assert.match(html, /home/);
  assert.match(html, /todos/);
  assert.match(html, /static/);
  assert.match(html, /island/);
});

test("panel là HTML hợp lệ (doctype + bảng)", () => {
  const html = renderResolutionPanel(mixed);
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<table/);
});

test("panel có section Recent requests khi truyền log", () => {
  const html = renderResolutionPanel(mixed, [
    { method: "GET", path: "/todos", status: 200, ms: 5, ts: 0 },
  ]);
  assert.match(html, /Recent requests/);
  assert.match(html, /\/todos/);
  assert.match(html, /200/);
  assert.match(html, /5ms/);
});

test("panel KHÔNG có section requests khi rỗng", () => {
  assert.doesNotMatch(renderResolutionPanel(mixed), /Recent requests/);
});
