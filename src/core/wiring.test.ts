import { test } from "node:test";
import assert from "node:assert/strict";
import { backendFromManifest } from "./wiring.ts";
import type { ResolutionManifest } from "./resolver.ts";

const base = (backend: ResolutionManifest["backend"]): ResolutionManifest => ({
  version: 1, profile: "t", backend, cells: {},
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
