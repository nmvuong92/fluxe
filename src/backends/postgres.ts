/* Backend Postgres — DRIVER PRODUCTION (cùng interface Backend, cùng pattern SQLite).
 * ⚠️ Cần: `npm i pg` + một Postgres đang chạy. KHÔNG được import bởi code đang chạy
 * trong repo này (chưa cài pg, chưa có server) → đây là adapter tham chiếu, sẵn sàng bật.
 * Bật: cài pg, set DATABASE_URL, rồi wire vào wiring.ts (lazy import) như một BackendKind.
 *
 * import { Client } from "pg";   // bỏ comment khi đã `npm i pg`
 */
import type { Backend, Todo } from "./types";

export interface PgClientLike {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
}

// Nhận sẵn client (đã connect) để testable + không buộc import pg ở repo này.
export function createPostgresBackend(client: PgClientLike): Backend {
  const toTodo = (r: any): Todo => ({ id: String(r.id), title: r.title, done: !!r.done });

  return {
    name: "postgres",
    async listTodos() {
      const { rows } = await client.query("SELECT * FROM todos ORDER BY id");
      return rows.map(toTodo);
    },
    async addTodo(title) {
      const { rows } = await client.query(
        "INSERT INTO todos (title, done) VALUES ($1, false) RETURNING *",
        [title],
      );
      return toTodo(rows[0]);
    },
    async toggleTodo(id) {
      await client.query("UPDATE todos SET done = NOT done WHERE id = $1", [id]);
      const { rows } = await client.query("SELECT * FROM todos ORDER BY id");
      return rows.map(toTodo);
    },
  };
}

/* Cách dùng thật (khi có pg + server):
 *   import { Client } from "pg";
 *   const client = new Client(process.env.DATABASE_URL);
 *   await client.connect();
 *   await client.query(`CREATE TABLE IF NOT EXISTS todos (
 *     id SERIAL PRIMARY KEY, title TEXT NOT NULL, done BOOLEAN NOT NULL DEFAULT false)`);
 *   const backend = createPostgresBackend(client);
 */
