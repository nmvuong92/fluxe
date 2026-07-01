// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { printSchema, graphql } from "graphql";
import { f } from "../core/contract.ts";
import { toGraphQLSchema } from "./schema.ts";

const Todo = f.object({ id: f.string, title: f.string, done: f.bool });
const contract = f.contract({
  listTodos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
  onTodos: f.subscription(Todo.array()),
});
const resolvers = {
  listTodos: () => [{ id: "1", title: "a", done: false }],
  addTodo: (input: { title: string }) => ({ id: "2", title: input.title, done: false }),
};

test("toGraphQLSchema: Query.listTodos + Mutation.addTodo(args) — subscription bỏ", () => {
  const sdl = printSchema(toGraphQLSchema(contract, resolvers));
  assert.match(sdl, /type Query/);
  assert.match(sdl, /listTodos/);
  assert.match(sdl, /type Mutation/);
  assert.match(sdl, /addTodo\(title: String!\)/);
});

const json = (v: any) => JSON.parse(JSON.stringify(v));   // GraphQL trả null-proto object → chuẩn hoá

test("toGraphQLSchema: execute query → gọi resolver", async () => {
  const r = await graphql({ schema: toGraphQLSchema(contract, resolvers), source: "{ listTodos { id title } }" });
  assert.equal(r.errors, undefined);
  assert.deepEqual(json(r.data!.listTodos), [{ id: "1", title: "a" }]);
});

test("toGraphQLSchema: mutation với args → resolver nhận input", async () => {
  const r = await graphql({ schema: toGraphQLSchema(contract, resolvers), source: 'mutation { addTodo(title: "x") { title } }' });
  assert.equal(r.errors, undefined);
  assert.deepEqual(json(r.data!.addTodo), { title: "x" });
});
