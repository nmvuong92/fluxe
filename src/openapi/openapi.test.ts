// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { f } from "../core/contract.ts";
import { toOpenApi } from "./openapi.ts";

const contract = f.contract({
  listTodos: f.query(f.object({ id: f.string, title: f.string }).array()),
  addTodo: f.mutation({ title: f.string }, f.object({ id: f.string })),
  onTodos: f.subscription(f.string.array()),
});

test("toOpenApi: 3.1 + mỗi query/mutation → POST /__rpc/<op>", () => {
  const doc = toOpenApi(contract, { title: "Todo API", version: "1.2.3" });
  assert.equal(doc.openapi, "3.1.0");
  assert.equal(doc.info.title, "Todo API");
  assert.equal(doc.info.version, "1.2.3");
  assert.ok(doc.paths["/__rpc/listTodos"].post);
  assert.ok(doc.paths["/__rpc/addTodo"].post);
});

test("toOpenApi: mutation có requestBody từ input schema", () => {
  const doc = toOpenApi(contract);
  const body = doc.paths["/__rpc/addTodo"].post.requestBody.content["application/json"].schema;
  assert.equal(body.properties.title.type, "string");
  assert.deepEqual(body.required, ["title"]);
});

test("toOpenApi: subscription (SSE) KHÔNG vào paths HTTP", () => {
  const doc = toOpenApi(contract);
  assert.equal(doc.paths["/__rpc/onTodos"], undefined);
});
