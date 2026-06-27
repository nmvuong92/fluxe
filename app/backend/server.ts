// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  BACKEND CỦA BẠN  —  Express (đã được `fx init` wire sẵn adapter fluxe).     ║
// ║  Bạn ghi TOÀN BỘ logic backend ở đây: route API, middleware, service, auth   ║
// ║  riêng… fluxe mount catch-all ở cuối → CORE lo giúp các vấn đề xuyên suốt:    ║
// ║  cells/SSR · session/CSRF · rate-limit · realtime (SSE) · validation ·       ║
// ║  upload · observability (/_fluxe). Bạn không phải tự dựng lại chúng.          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝
import express from "express";
import { readFileSync } from "node:fs";
import { fluxe } from "../../src/adapters/express";          // published: @nmvuong92/fluxe/express
import { createLocalStorage } from "../../src/storage/local";
import type { ResolutionManifest } from "../../src/core/resolver";
import { env } from "../env";
import { cells } from "../app";
import { layouts } from "../layouts/index";
import { i18n } from "../i18n";
import { backend } from "./data";   // tầng data/service — DÙNG CHUNG cho route Express + cell

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const storage = createLocalStorage({ dir: ".fluxe/uploads" });
const app = express();

// ── LOGIC BACKEND CỦA BẠN (chạy TRƯỚC fluxe) ──────────────────────────────────
// Route/middleware Express tuỳ ý — dùng chung `backend` (service) với cell fluxe:
app.get("/api/todos", async (_req, res) => res.json(await backend.listTodos()));
// app.use("/admin", yourAuthMiddleware);   // middleware riêng của bạn…

// ── fluxe = catch-all: cells/SSR + core concerns cho phần còn lại ─────────────
app.use(fluxe(manifest, cells, layouts, { i18n, storage, backend }));

app.listen(env.PORT, () =>
  console.log(`fluxe @ http://localhost:${env.PORT} (Express · backend: ${backend.name} · env: ${env.NODE_ENV})`));
