// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Entry server — Fastify mount fluxe (catch-all). Route riêng của bạn đặt TRƯỚC. */
import Fastify from "fastify";
import { fluxe } from "@nmvuong92/fluxe/fastify";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeApp } from "./app.ts";
import { env } from "./env.ts";

const { app, store, manifest } = await makeApp();

const server = Fastify();
// 👉 Route Fastify RIÊNG của bạn (chạy trước fluxe, giữ body-parsing của Fastify):
server.get("/api/todos", () => store.list());

await server.register(fluxe(manifest, cells, layouts, {
  i18n, backend: store, contract: app.contract, resolvers: app.resolvers,
}));
await server.listen({ port: env.PORT });
console.log(`http://localhost:${env.PORT} (Fastify · backend: ${store.name})`);
