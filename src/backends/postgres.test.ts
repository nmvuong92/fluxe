import { test } from "node:test";
import assert from "node:assert/strict";
import { createPostgresBackend, type PgClientLike } from "./postgres.ts";

// Fake client: ghi log query (test SQL/param mà KHÔNG cần Postgres server).
function fakeClient() {
  const log: { sql: string; params?: unknown[] }[] = [];
  const rows: any[] = [];
  const client: PgClientLike = {
    async query(sql, params) {
      log.push({ sql, params });
      if (/RETURNING/.test(sql)) return { rows: [{ id: 1, title: (params as any[])[0], done: false }] };
      if (/^SELECT/.test(sql.trim())) return { rows };
      return { rows: [] };
    },
  };
  return { client, log, rows };
}

test("addTodo: INSERT … RETURNING + param hóa (chống SQLi)", async () => {
  const { client, log } = fakeClient();
  const b = createPostgresBackend(client);
  const t = await b.addTodo("việc x");
  assert.equal(t.title, "việc x");
  assert.match(log.at(-1)!.sql, /INSERT INTO todos/);
  assert.deepEqual(log.at(-1)!.params, ["việc x"]);
});

test("toggleTodo: UPDATE … SET done = NOT done + param", async () => {
  const { client, log } = fakeClient();
  const b = createPostgresBackend(client);
  await b.toggleTodo("5");
  assert.match(log[0].sql, /SET done = NOT done/);
  assert.deepEqual(log[0].params, ["5"]);
  assert.equal(b.name, "postgres");
});
