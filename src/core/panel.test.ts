// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderResolutionPanel } from "./panel.ts";
import type { ResolutionManifest } from "./resolver.ts";

const mixed: ResolutionManifest = {
  version: 1, profile: "mixed",
  backend: { language: "memory" },
  cells: {
    home: { id: "home", route: "/", render: { mode: "static", shipClientJs: false }, backend: { language: "memory" } },
    todos: { id: "todos", route: "/todos", render: { mode: "island", shipClientJs: true }, backend: { language: "sqlite" } },
  },
};

test("panel hiển thị tiêu đề + profile + default backend", () => {
  const html = renderResolutionPanel(mixed);
  assert.match(html, /RCA Resolution/);
  assert.match(html, /mixed/);
  assert.match(html, /default backend/i);
});

test("panel có hàng per-cell với render + backend đúng", () => {
  const html = renderResolutionPanel(mixed);
  assert.match(html, /home/);
  assert.match(html, /todos/);
  assert.match(html, /static/);
  assert.match(html, /island/);
  assert.match(html, /memory/);
  assert.match(html, /sqlite/);
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
