// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHooks } from "./hooks.ts";
import { detailsToErrors } from "./form.ts";
import { queryStats } from "./query.ts";
import { f } from "../core/contract.ts";

const contract = f.contract({
  todos: f.query(f.object({ id: f.string }).array()),
  addTodo: f.mutation({ title: f.string }, f.object({ id: f.string })),
  feed: f.subscription(f.object({ id: f.string }).array()),
});

test("[hooks] createHooks proxy: op → hook fn theo kind", () => {
  // client giả → không fetch thật.
  const api = createHooks<typeof contract>({ todos: async () => [], addTodo: async () => ({ id: "1" }) } as any);
  assert.equal(typeof api.todos.useQuery, "function");
  assert.equal(typeof (api.addTodo as any).useMutation, "function");
  assert.equal(typeof (api.addTodo as any).useForm, "function");
  assert.equal(typeof (api.feed as any).useSubscription, "function");
});

test("[hooks] memo: cùng op trả cùng object (ổn định reference)", () => {
  const api = createHooks<typeof contract>({ todos: async () => [], addTodo: async () => ({}) } as any);
  assert.equal((api as any).todos, (api as any).todos);
});

test("[devtools] queryStats: object số (mounted/cached/inflight ≥ 0)", () => {
  const s = queryStats();
  for (const k of ["mounted", "cached", "inflight"] as const) {
    assert.equal(typeof s[k], "number");
    assert.ok(s[k] >= 0);
  }
});

test("[form] detailsToErrors: path→message, bỏ (root), dedup", () => {
  const errs = detailsToErrors([
    { path: "title", message: "Bắt buộc" },
    { path: "title", message: "trùng — bỏ qua" },
    { path: "(root)", message: "lỗi gốc" },
  ]);
  assert.equal(errs.title, "Bắt buộc");
  assert.equal(errs["(root)"], undefined);
  assert.equal(Object.keys(errs).length, 1);
});
