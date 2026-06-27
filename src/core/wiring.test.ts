// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { backendFromManifest, backendsFromManifest } from "./wiring.ts";
import type { ResolutionManifest, BackendResolution, CellResolution } from "./resolver.ts";

const base = (backend: ResolutionManifest["backend"]): ResolutionManifest => ({
  version: 1, profile: "t", backend, cells: {},
});

const MEM: BackendResolution = { language: "memory", transport: "in-process" };
const GO: BackendResolution = { language: "go", transport: "http", endpoint: "http://127.0.0.1:8081" };
const cell = (id: string, backend: BackendResolution): CellResolution => ({
  id, route: "/" + id, render: { mode: "static", shipClientJs: false }, backend,
});

test("memory manifest → memory backend", () => {
  const b = backendFromManifest(base({ language: "memory", transport: "in-process" }));
  assert.equal(b.name, "memory");
});

test("go manifest → http backend named 'go'", () => {
  const b = backendFromManifest(base({ language: "go", transport: "http", endpoint: "http://127.0.0.1:8081" }));
  assert.equal(b.name, "go");
});

test("fail-fast: http language without endpoint", () => {
  assert.throws(
    () => backendFromManifest(base({ language: "rust", transport: "http" })),
    /thiếu endpoint/,
  );
});

test("backendsFromManifest: per-cell backend đúng tên", () => {
  const m: ResolutionManifest = {
    version: 1, profile: "mixed", backend: MEM,
    cells: { home: cell("home", MEM), todos: cell("todos", GO) },
  };
  const { byCell, default: def } = backendsFromManifest(m);
  assert.equal(byCell.get("home")!.name, "memory");
  assert.equal(byCell.get("todos")!.name, "go");
  assert.equal(def.name, "memory");
});

test("backendsFromManifest: dedup — cells cùng resolution chia sẻ MỘT instance", () => {
  const m: ResolutionManifest = {
    version: 1, profile: "dev", backend: MEM,
    cells: { home: cell("home", MEM), todos: cell("todos", MEM) },
  };
  const { byCell, default: def } = backendsFromManifest(m);
  assert.equal(byCell.get("home"), byCell.get("todos")); // cùng object
  assert.equal(byCell.get("home"), def);                 // và = default
});
