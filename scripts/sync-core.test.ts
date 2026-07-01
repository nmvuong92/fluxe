// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanFeatures, renderRegistry } from "./sync-core.ts";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "fx-"));
  const f = join(root, "features", "home");
  mkdirSync(f, { recursive: true });
  writeFileSync(join(f, "home.cell.tsx"), "export default {};");
  writeFileSync(join(f, "home.view.tsx"), "export default () => null;");
  return root;
}

test("scanFeatures tìm cell theo *.cell.tsx + view kèm", () => {
  const entries = scanFeatures(fixture());
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, "home");
  assert.equal(entries[0].feature, "home");
  assert.equal(entries[0].hasView, true);
});

test("renderRegistry sinh import + cells[] + views map", () => {
  const out = renderRegistry(scanFeatures(fixture()));
  assert.match(out, /import homeCell from ".\/features\/home\/home.cell"/);
  assert.match(out, /import homeView from ".\/features\/home\/home.view"/);
  assert.match(out, /export const cells.*= \[homeCell\]/);
  assert.match(out, /"home": homeView/);
});
