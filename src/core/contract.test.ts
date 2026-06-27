// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { defineContract, tsType, genContractTypes, genZod, genServer, genClient } from "./contract.ts";

test("tsType: scalar/array/optional/ref", () => {
  assert.equal(tsType("string"), "string");
  assert.equal(tsType("int"), "number");
  assert.equal(tsType("bool"), "boolean");
  assert.equal(tsType("Todo"), "Todo");
  assert.equal(tsType("Todo[]"), "Todo[]");
  assert.equal(tsType("string?"), "string | undefined");
  assert.equal(tsType("Order?"), "Order | undefined");
});

test("genContractTypes: type interfaces + op Input", () => {
  const c = defineContract({
    types: { Todo: { id: "string", title: "string", done: "bool" } },
    mutations: { addTodo: { in: { title: "string" }, out: "Todo" } },
  });
  const out = genContractTypes(c);
  assert.match(out, /export interface Todo \{/);
  assert.match(out, /done: boolean;/);
  assert.match(out, /export interface AddTodoInput \{/);
  assert.match(out, /title: string;/);
});

test("genZod: input schema per op", () => {
  const c = defineContract({
    queries: { order: { in: { id: "string" }, out: "Order?" } },
    mutations: { addTodo: { in: { title: "string", qty: "int?" }, out: "Todo" }, ping: { out: "bool" } },
  });
  const out = genZod(c);
  assert.match(out, /import \{ z \} from "zod";/);
  assert.match(out, /export const addTodoInput = z\.object\(\{/);
  assert.match(out, /title: z\.string\(\)/);
  assert.match(out, /qty: z\.number\(\)\.optional\(\)/);
  assert.match(out, /export const orderInput = z\.object/);
  assert.doesNotMatch(out, /pingInput/);
  assert.match(out, /export const validators = \{/);
  assert.match(out, /addTodo: addTodoInput,/);
});

test("genServer: Resolvers interface + OPS kind + createApi", () => {
  const c = defineContract({
    types: { Todo: { id: "string" } },
    queries: { todos: { out: "Todo[]" } },
    mutations: { addTodo: { in: { title: "string" }, out: "Todo" } },
  });
  const out = genServer(c);
  assert.match(out, /export interface Resolvers \{/);
  assert.match(out, /todos\(\): Promise<Todo\[\]>;/);
  assert.match(out, /addTodo\(input: AddTodoInput\): Promise<Todo>;/);
  assert.match(out, /todos: "query"/);
  assert.match(out, /addTodo: "mutation"/);
  assert.match(out, /export function createApi/);
});

test("genClient: typed api object", () => {
  const c = defineContract({
    types: { Todo: { id: "string" } },
    queries: { todos: { out: "Todo[]" } },
    mutations: { addTodo: { in: { title: "string" }, out: "Todo" } },
  });
  const out = genClient(c);
  assert.match(out, /import \{ rpcCall \} from "@nmvuong92\/fluxe\/client";/);
  assert.match(out, /todos: \(\): Promise<Todo\[\]> => rpcCall\("todos"\)/);
  assert.match(out, /addTodo: \(input: AddTodoInput\): Promise<Todo> => rpcCall\("addTodo", input\)/);
});
