// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { DebugEvent } from "./store";

/* Repro → Test: từ một event (label "rpc:cell.action", input, data) sinh sẵn một test
 * dùng createTestBackend — biến bug thành test deterministic, dán vào là chạy. Thuần. */
export function reproTest(ev: DebugEvent & { input?: unknown }): string {
  const m = ev.label.match(/^rpc:([^.]+)\.(.+)$/);
  const cell = m?.[1] ?? "cell";
  const action = m?.[2] ?? "action";
  const input = JSON.stringify(ev.input ?? {});
  const expected = JSON.stringify(ev.data ?? null);
  return `import { test } from "node:test";
import assert from "node:assert/strict";
import ${cell} from "../app/cells/${cell}/index";
import { createTestBackend } from "../src/core/testing";

test("repro: ${cell}.${action}", async () => {
  const backend = createTestBackend();
  const out = await ${cell}.actions!.${action}({ input: ${input}, backend });
  assert.deepEqual(out, ${expected});
});`;
}
