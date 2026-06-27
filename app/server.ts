// SERVER ENTRY của app — bạn sở hữu. Chọn framework tuỳ ý; demo mặc định: Express.
// fluxe nhúng vào như middleware catch-all (đặt SAU route/middleware riêng của bạn).
import express from "express";
import { readFileSync } from "node:fs";
import { fluxe } from "../src/adapters/express";          // published: @nmvuong92/fluxe/express
import { createLocalStorage } from "../src/storage/local";
import type { ResolutionManifest } from "../src/core/resolver";
import { env } from "./env";
import { cells } from "./app";
import { layouts } from "./layouts/index";
import { i18n } from "./i18n";
import { backend } from "./backend";

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const storage = createLocalStorage({ dir: ".fluxe/uploads" });

const app = express();
// 👉 Route / middleware Express RIÊNG của bạn đặt ở đây (chạy trước fluxe), ví dụ:
// app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use(fluxe(manifest, cells, layouts, { i18n, storage, backend }));   // fluxe = catch-all
app.listen(env.PORT, () =>
  console.log(`fluxe @ http://localhost:${env.PORT} (Express · backend: ${backend.name} · env: ${env.NODE_ENV})`));
