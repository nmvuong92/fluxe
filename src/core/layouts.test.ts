import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutChain } from "./layouts.ts";

const defs = {
  site: { id: "site" },
  app: { id: "app", parent: "site" },
};

test("không layout → chuỗi rỗng", () => {
  assert.deepEqual(layoutChain(undefined, defs), []);
});

test("nested: inner→outer (app rồi site)", () => {
  assert.deepEqual(layoutChain("app", defs), ["app", "site"]);
});

test("một tầng", () => {
  assert.deepEqual(layoutChain("site", defs), ["site"]);
});

test("fail-fast: layout không tồn tại", () => {
  assert.throws(() => layoutChain("ghost", defs), /không tồn tại/);
});

test("fail-fast: vòng lặp", () => {
  const cyc = { a: { id: "a", parent: "b" }, b: { id: "b", parent: "a" } };
  assert.throws(() => layoutChain("a", cyc), /vòng lặp/);
});
