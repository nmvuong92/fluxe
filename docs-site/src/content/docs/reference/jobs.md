---
title: Jobs
description: Durable job queue (SQLite) — createQueue/drain/dead-letter.
sidebar:
  order: 31
---

## Định nghĩa

**Job queue bền (durable)** là hàng đợi việc nền: thay vì làm việc nặng (gửi email, gọi dịch vụ
ngoài) ngay trong request, ta `enqueue` một job rồi để worker xử lý sau. Bối cảnh fluxe: queue
backed bằng **SQLite** nên job **sống qua restart** — không mất việc khi process chết.

Vòng đời: `enqueue → processNext` (claim 1 job, chạy handler). Nếu handler `throw` thì `attempts++`
và job quay lại `pending` để retry; khi cạn `maxAttempts` → chuyển sang **dead-letter** (`dead`)
để con người can thiệp. Đây là ứng dụng của cấu trúc **Queue** (xem bảng DSA trong CLAUDE.md).

## Cơ chế trong fluxe

**Worker `drain`** — xử lý cạn job pending (luôn kết thúc vì retry/dead-letter bao bọc):

```ts
// @nmvuong92/fluxe/jobs
export async function drain(queue: Queue, handlers: Record<string, JobHandler>, opts?: { maxAttempts?: number }): Promise<number> {
  let n = 0;
  while (await queue.processNext(handlers, opts)) n++;
  return n;
}
```

**`createQueue`** — bảng `jobs` SQLite, claim job pending id nhỏ nhất, retry → dead-letter:

```ts
// @nmvuong92/fluxe/jobs
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
  // …
  return {
    enqueue(type, payload): Job {
      const info = db.prepare("INSERT INTO jobs (type, payload) VALUES (?, ?)").run(type, JSON.stringify(payload));
      return toJob(db.prepare("SELECT * FROM jobs WHERE id = ?").get(info.lastInsertRowid));
    },
    pending: () => countByStatus("pending"),
    dead: () => countByStatus("dead"),

    // Claim 1 job pending (id nhỏ nhất), chạy handler; lỗi → attempts++ , dead nếu cạn retry.
    async processNext(handlers, opts = {}): Promise<Job | null> {
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
```

| Trạng thái | Ý nghĩa |
|-----------|---------|
| `pending` | chờ xử lý / đang retry |
| `done` | xong |
| `dead` | cạn `maxAttempts` → dead-letter (cần can thiệp) |

## Ví dụ

`scripts/jobs-demo.ts` — enqueue 3 job (một cái cố tình fail → dead-letter), rồi `drain`:

```ts
// scripts/jobs-demo.ts
import { createQueue, drain } from "@nmvuong92/fluxe/jobs";

const q = createQueue(); // in-memory cho demo (prod: file/Postgres)
q.enqueue("email", { to: "alice@example.com" });
q.enqueue("email", { to: "bob@example.com" });
q.enqueue("flaky", { task: "gọi dịch vụ ngoài" });

const handlers = {
  email: async (p: any) => console.log(`  ✉  gửi email → ${p.to}`),
  flaky: async () => { throw new Error("dịch vụ ngoài lỗi"); },
};

console.log(`[jobs] pending trước khi chạy: ${q.pending()}`);
const ran = await drain(q, handlers, { maxAttempts: 2 });
console.log(`[jobs] worker chạy ${ran} lượt → done & dead-letter: pending=${q.pending()}, dead=${q.dead()}`);
```

Chạy (cần cờ `--experimental-sqlite`):

```bash
node --experimental-sqlite scripts/jobs-demo.ts
```

## API

```ts
// @nmvuong92/fluxe/jobs
createQueue(path = ":memory:"): Queue
drain(queue, handlers, opts?: { maxAttempts? }): Promise<number>   // xử lý cạn job pending, trả số lượt

interface Queue {
  enqueue(type: string, payload: unknown): Job;
  pending(): number;
  dead(): number;                                                   // số job dead-letter
  processNext(handlers, opts?: { maxAttempts? }): Promise<Job | null>;
}

interface Job {
  id: number; type: string; payload: any;
  status: "pending" | "done" | "dead"; attempts: number;
}
```

## Lưu ý

- **Cần cờ `node --experimental-sqlite`** — module `node:sqlite` còn experimental. Thiếu cờ →
  import lỗi.
- `path = ":memory:"` (mặc định) chỉ sống trong process — dùng cho demo/test. Production truyền
  **đường dẫn file** (vd `createQueue("./jobs.db")`) để bền qua restart.
- `maxAttempts` mặc định `3`. Job hết retry chuyển `dead`, **không tự chạy lại** — cần can thiệp;
  `last_error` lưu lý do fail cuối.
- Handler thiếu cho một `type` cũng coi là lỗi → job vẫn retry/dead theo cơ chế chung.
- Đổi sang Postgres (`SELECT … FOR UPDATE SKIP LOCKED`) / SQS / NATS giữ **cùng interface** —
  job code không đổi.
