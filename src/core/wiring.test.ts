// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { backendFromManifest, backendsFromManifest } from "./wiring.ts";
import type { ResolutionManifest, BackendResolution, CellResolution } from "./resolver.ts";

const base = (backend: ResolutionManifest["backend"]): ResolutionManifest => ({
  version: 1, profile: "t", backend, cells: {},
});

const MEM: BackendResolution = { language: "memory" };
const SQLITE: BackendResolution = { language: "sqlite" };
const cell = (id: string, backend: BackendResolution): CellResolution => ({
  id, route: "/" + id, render: { mode: "static", shipClientJs: false }, backend,
});

test("memory manifest → memory backend", () => {
  const b = backendFromManifest(base({ language: "memory" }));
  assert.equal(b.name, "memory");
});

test("sqlite manifest → sqlite backend", () => {
  const b = backendFromManifest(base({ language: "sqlite" }));
  assert.equal(b.name, "sqlite");
});

test("fail-fast: postgres không dựng được tự động (cần inject client)", () => {
  assert.throws(
    () => backendFromManifest(base({ language: "postgres" })),
    /không dựng được tự động/,
  );
});

test("backendsFromManifest: per-cell backend đúng tên", () => {
  const m: ResolutionManifest = {
    version: 1, profile: "mixed", backend: MEM,
    cells: { home: cell("home", MEM), todos: cell("todos", SQLITE) },
  };
  const { byCell, default: def } = backendsFromManifest(m);
  assert.equal(byCell.get("home")!.name, "memory");
  assert.equal(byCell.get("todos")!.name, "sqlite");
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
