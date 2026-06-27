// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";
import type { Backend, Todo } from "./types";

/* Backend DB THẬT — SQLite qua node:sqlite (built-in, 0 dep, persist ra file).
 * Chạy cần cờ: node --experimental-sqlite … Cùng interface Backend → switch như mọi backend. */
export function createSqliteBackend(path = ":memory:"): Backend {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0
  )`);

  const toTodo = (r: any): Todo => ({ id: String(r.id), title: r.title, done: !!r.done });
  const all = () => db.prepare("SELECT * FROM todos ORDER BY id").all().map(toTodo);

  return {
    name: "sqlite",
    async listTodos() {
      return all();
    },
    async addTodo(title) {
      const info = db.prepare("INSERT INTO todos (title) VALUES (?)").run(title);
      return toTodo(db.prepare("SELECT * FROM todos WHERE id = ?").get(info.lastInsertRowid));
    },
    async toggleTodo(id) {
      db.prepare("UPDATE todos SET done = 1 - done WHERE id = ?").run(Number(id));
      return all();
    },
  };
}
