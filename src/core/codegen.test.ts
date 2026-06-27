// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { genTS, genGo, genRust, type Schema } from "./codegen.ts";

const schema: Schema = { types: { Todo: { id: "string", title: "string", done: "bool" } } };

test("genTS: interface với kiểu TS", () => {
  const ts = genTS(schema);
  assert.match(ts, /export interface Todo \{/);
  assert.match(ts, /id: string;/);
  assert.match(ts, /done: boolean;/);
});

test("genGo: struct + json tag + field PascalCase", () => {
  const go = genGo(schema, "contract");
  assert.match(go, /package contract/);
  assert.match(go, /type Todo struct \{/);
  assert.match(go, /Id\s+string\s+`json:"id"`/);
  assert.match(go, /Done\s+bool\s+`json:"done"`/);
});

test("genRust: pub struct + kiểu Rust", () => {
  const rs = genRust(schema);
  assert.match(rs, /pub struct Todo \{/);
  assert.match(rs, /pub id: String,/);
  assert.match(rs, /pub done: bool,/);
});

test("int map đúng mỗi ngôn ngữ", () => {
  const s: Schema = { types: { N: { n: "int" } } };
  assert.match(genTS(s), /n: number;/);
  assert.match(genGo(s), /N\s+int/);
  assert.match(genRust(s), /pub n: i64,/);
});
