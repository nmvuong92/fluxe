// JOB QUEUE (host-owned) — bullmq + redis. fluxe KHÔNG làm queue (đã gỡ); host lo.
// Việc: đóng phiên ĐÚNG GIỜ (delayed job tới endsAt) → publish realtime "SOLD" + gửi mail người thắng.
// Decouple: resolver chỉ publish "lot:created" lên broker; jobs subscribe → schedule (không import ngược).
import { Queue, Worker } from "bullmq";
import { backend as store } from "./data";
import { broker } from "./broker";
import type { Lot } from "./data";

// Connection opts (bullmq tự tạo ioredis nội bộ) — tránh clash 2 bản ioredis (top-level vs bullmq).
const u = new URL(process.env.REDIS_URL || "redis://localhost:6379");
const connection = { host: u.hostname, port: Number(u.port) || 6379, maxRetriesPerRequest: null };
const QUEUE = "bidly";
export const queue = new Queue(QUEUE, { connection });

// Lên lịch đóng phiên tại endsAt (jobId theo lot → idempotent, không double-schedule).
export async function scheduleClose(lotId: string, endsAt: number) {
  const delay = Math.max(0, endsAt - Date.now());
  await queue.add("closeLot", { lotId }, { delay, jobId: `close_${lotId}`, removeOnComplete: true, removeOnFail: true });
}

// Worker + cầu nối broker. Gọi 1 lần ở server.ts.
export function startJobs() {
  // resolver createLot → publish("lot:created", lot) → schedule đóng phiên (host không cần đụng resolver).
  broker.subscribe("lot:created", (lot) => {
    const l = lot as Lot;
    scheduleClose(l.id, l.endsAt).catch((e) => console.error("[jobs] scheduleClose fail:", e.message));
  });

  const worker = new Worker(QUEUE, async (job) => {
    if (job.name === "closeLot") {
      const lot = await store.closeLot(job.data.lotId);
      broker.publish(`lot:${lot.id}`, lot);                         // realtime: client thấy SOLD/CANCELLED
      if (lot.status === "sold") {
        await queue.add("winnerEmail", { lotId: lot.id, winner: lot.currentLeader, amount: lot.currentPrice });
        if (lot.currentLeader) broker.publish(`notif:${lot.currentLeader}`, { type: "won", lotId: lot.id, title: lot.title, amount: lot.currentPrice });
      }
      return lot;
    }
    if (job.name === "winnerEmail") {
      // Demo "gửi email" — thật thì gọi provider (Resend/SES…). Host lo, fluxe không liên quan.
      console.log(`[email] 🏆 lot ${job.data.lotId} bán $${job.data.amount} → mail winner ${job.data.winner}`);
    }
  }, { connection });

  worker.on("failed", (job, err) => console.error(`[jobs] ${job?.name} fail:`, err.message));
  console.log("[jobs] bullmq worker started (queue=bidly)");
  return worker;
}
