// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";

/* Background jobs / queue BỀN (6b.B) — backed bằng SQLite (persist qua restart).
 * enqueue → processNext (claim 1 job, chạy handler, retry/backoff, dead-letter).
 * Production: đổi driver sang Postgres (SELECT … FOR UPDATE SKIP LOCKED) / SQS / NATS —
 * cùng interface, job code không đổi. Chạy cần cờ: node --experimental-sqlite. */

export interface Job {
  id: number;
  type: string;
  payload: any;
  status: "pending" | "done" | "dead";
  attempts: number;
}

export type JobHandler = (payload: any) => Promise<void>;

export interface Queue {
  enqueue(type: string, payload: unknown): Job;
  pending(): number;
  dead(): number;
  processNext(handlers: Record<string, JobHandler>, opts?: { maxAttempts?: number }): Promise<Job | null>;
}

/* Worker: xử lý cạn job pending (retry → dead-letter bao bọc nên luôn kết thúc). */
export async function drain(queue: Queue, handlers: Record<string, JobHandler>, opts?: { maxAttempts?: number }): Promise<number> {
  let n = 0;
  while (await queue.processNext(handlers, opts)) n++;
  return n;
}

export function createQueue(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  )`);

  const toJob = (r: any): Job => ({
    id: r.id, type: r.type, payload: JSON.parse(r.payload), status: r.status, attempts: r.attempts,
  });
  const countByStatus = (s: string) =>
    (db.prepare("SELECT COUNT(*) c FROM jobs WHERE status = ?").get(s) as any).c as number;

  return {
    enqueue(type: string, payload: unknown): Job {
      const info = db.prepare("INSERT INTO jobs (type, payload) VALUES (?, ?)").run(type, JSON.stringify(payload));
      return toJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(info.lastInsertRowid));
    },
    pending: () => countByStatus("pending"),
    dead: () => countByStatus("dead"),

    // Claim 1 job pending (id nhỏ nhất), chạy handler; lỗi → attempts++ , dead nếu cạn retry.
    async processNext(handlers: Record<string, JobHandler>, opts: { maxAttempts?: number } = {}): Promise<Job | null> {
      const max = opts.maxAttempts ?? 3;
      const row = db.prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1").get();
      if (!row) return null;
      const job = toJob(row);
      try {
        const handler = handlers[job.type];
        if (!handler) throw new Error(`không có handler cho type '${job.type}'`);
        await handler(job.payload);
        db.prepare("UPDATE jobs SET status = 'done' WHERE id = ?").run(job.id);
        return { ...job, status: "done" };
      } catch (e: any) {
        const attempts = job.attempts + 1;
        const dead = attempts >= max;
        db.prepare("UPDATE jobs SET attempts = ?, status = ?, last_error = ? WHERE id = ?")
          .run(attempts, dead ? "dead" : "pending", String(e?.message ?? e), job.id);
        return { ...job, attempts, status: dead ? "dead" : "pending" };
      }
    },
  };
}
