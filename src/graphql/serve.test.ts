// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { f } from "../core/contract.ts";
import { graphqlHandler } from "./serve.ts";

const Todo = f.object({ id: f.string, title: f.string });
const contract = f.contract({
  listTodos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
});
const resolvers = {
  listTodos: () => [{ id: "1", title: "a" }],
  addTodo: (i: { title: string }) => ({ id: "2", title: i.title }),
};

async function serve() {
  const h = graphqlHandler(contract, resolvers);
  const server = http.createServer((req, res) => h(req, res, () => { res.writeHead(404); res.end("nf"); }));
  await new Promise<void>((r) => server.listen(0, r));
  return { port: (server.address() as any).port, close: () => new Promise<void>((r) => server.close(() => r())) };
}

test("[graphql] POST /graphql query → data từ resolver", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "{ listTodos { id title } }" }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body.data.listTodos, [{ id: "1", title: "a" }]);
  } finally { await close(); }
});

test("[graphql] path khác → next() (fluxe/host lo tiếp)", async () => {
  const { port, close } = await serve();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/other`);
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "nf");
  } finally { await close(); }
});
