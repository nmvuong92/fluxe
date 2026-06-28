// Broker realtime DÙNG CHUNG giữa fluxe (SSE) và job worker (bullmq).
// Host tạo → tiêm vào fluxe (server.ts: fluxe(..., { broker })) → worker publish cùng bus
// → SSE client nhận. Đây là điểm nối host↔core cho realtime-from-jobs.
import { createBroker } from "@nmvuong92/fluxe";

export const broker = createBroker();
