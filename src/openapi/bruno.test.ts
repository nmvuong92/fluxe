// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { f } from "../core/contract.ts";
import { toBruno } from "./bruno.ts";

const contract = f.contract({
  listTodos: f.query(f.object({ id: f.string }).array()),
  addTodo: f.mutation({ title: f.string }, f.object({ id: f.string })),
  getTodo: f.query(f.object({ id: f.string }), { input: { id: f.string }, rest: { method: "GET", path: "/v1/todos/:id" } }),
  onTodos: f.subscription(f.string.array()),
});

test("toBruno: sinh bruno.json + environment + 1 .bru mỗi op", () => {
  const files = toBruno(contract, { name: "Todo API", baseUrl: "http://localhost:5180" });
  assert.match(files["bruno.json"], /"name": "Todo API"/);
  assert.match(files["bruno.json"], /"type": "collection"/);
  assert.match(files["environments/local.bru"], /baseUrl: http:\/\/localhost:5180/);
});

test("toBruno: mutation .bru có post + body:json với field từ input", () => {
  const files = toBruno(contract, { name: "X", baseUrl: "http://x" });
  const bru = files["addTodo.bru"];
  assert.match(bru, /post \{/);
  assert.match(bru, /url: \{\{baseUrl\}\}\/__rpc\/addTodo/);
  assert.match(bru, /body: json/);
  assert.match(bru, /"title"/);
});

test("toBruno: query .bru body:none; subscription KHÔNG sinh file", () => {
  const files = toBruno(contract, { name: "X", baseUrl: "http://x" });
  assert.match(files["listTodos.bru"], /body: none/);
  assert.equal(files["onTodos.bru"], undefined);
});

test("toBruno: op có rest → dùng method + path REST thật", () => {
  const files = toBruno(contract, { name: "X", baseUrl: "http://x" });
  assert.match(files["getTodo.bru"], /get \{/);
  assert.match(files["getTodo.bru"], /url: \{\{baseUrl\}\}\/v1\/todos\/:id/);
});
