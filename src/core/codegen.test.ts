// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { genTS, type Schema } from "./codegen.ts";

const schema: Schema = { types: { Todo: { id: "string", title: "string", done: "bool" } } };

test("genTS: interface với kiểu TS", () => {
  const ts = genTS(schema);
  assert.match(ts, /export interface Todo \{/);
  assert.match(ts, /id: string;/);
  assert.match(ts, /done: boolean;/);
});

test("int map đúng kiểu number", () => {
  const s: Schema = { types: { N: { n: "int" } } };
  assert.match(genTS(s), /n: number;/);
});
