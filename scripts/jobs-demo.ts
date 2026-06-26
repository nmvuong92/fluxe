/* Demo job queue: enqueue vài job (có cái fail → dead-letter), worker drain. */
import { createQueue, drain } from "../src/core/jobs";

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
console.log("→ Job bền (SQLite), retry rồi dead-letter khi cạn; cùng interface đổi driver Postgres/SQS.");
