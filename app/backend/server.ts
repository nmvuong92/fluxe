// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  BACKEND CỦA BẠN  —  Express (đã được `fx init` wire sẵn adapter fluxe).     ║
// ║  Bạn ghi TOÀN BỘ logic backend ở đây: route API, middleware, service, auth   ║
// ║  riêng… fluxe mount catch-all ở cuối → CORE lo giúp các vấn đề xuyên suốt:    ║
// ║  cells/SSR · session/CSRF · rate-limit · realtime (SSE) · validation ·       ║
// ║  upload · observability (/_fluxe). Bạn không phải tự dựng lại chúng.          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import express from "express";
import { readFileSync } from "node:fs";
import { toNodeHandler } from "better-auth/node";
import { fluxe } from "../../src/adapters/express";          // published: @nmvuong92/fluxe/express
import type { ResolutionManifest } from "../../src/core/resolver";
import { env } from "../env";
import { cells } from "../app";
import { layouts } from "../layouts/index";
import { i18n } from "../i18n";
import { backend } from "./data";        // tầng data/service — cells dùng (ctx.backend)
import { resolvers } from "./index";     // contract resolvers — phục vụ /__rpc (DB ẩn trong)
import { contract } from "../contract";  // khai báo operations (Zod schema sẵn → 0 codegen)
import { sessionMw } from "../auth";      // bridge session provider → req.session (fluxe đọc)
import { auth } from "./auth-server";     // better-auth (provider — host sở hữu)
import { broker } from "./broker";        // broker DÙNG CHUNG (fluxe SSE + job worker + WS)
import { startJobs } from "./jobs";       // bullmq worker (host-owned queue)
import { attachWs } from "./ws";          // WebSocket 2-chiều (host-owned, cạnh fluxe)

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const app = express();

// ── AUTH PROVIDER: better-auth handler (TRƯỚC mọi body parser + fluxe) ─────────
// /api/auth/* → sign-up/in/out, session… (better-auth lo). RegExp vì Express 5 bỏ bare '*'.
app.all(/^\/api\/auth\//, toNodeHandler(auth));

// ── AUTH BRIDGE: gắn req.session từ better-auth (mount TRƯỚC fluxe) → ctx.session + guard ──
app.use(sessionMw);

// ── LOGIC BACKEND CỦA BẠN (chạy TRƯỚC fluxe) ──────────────────────────────────
// Route/middleware Express tuỳ ý — dùng chung `backend` (service) với cell fluxe:
app.get("/api/todos", async (_req, res) => res.json(await backend.listTodos()));

// ── JOBS: bullmq worker (host) — đóng phiên đúng giờ + mail; publish realtime qua broker chung ──
startJobs();

// ── fluxe = catch-all: cells/SSR + core concerns. broker CHUNG để job publish realtime tới SSE ──
app.use(fluxe(manifest, cells, layouts, { i18n, backend, resolvers, contract, broker }));

const server = app.listen(env.PORT, () =>
  console.log(`fluxe @ http://localhost:${env.PORT} (Express · backend: ${backend.name} · env: ${env.NODE_ENV})`));

// ── WEBSOCKET: gắn lên CÙNG http server (upgrade /ws) — WS 2-chiều host lo, fluxe lo SSE ──
attachWs(server);
