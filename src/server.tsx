// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Engine dev entry (node:http zero-dep) — dogfood app/ starter. `dev:node` dùng cái này.
 * makeApp() gom module qua createApp → app.handler (node handler). */
import http from "node:http";
import { makeApp } from "../app/backend/app";
import { env } from "../app/backend/env";

const { app, store } = await makeApp();
http.createServer(app.handler!).listen(env.PORT, () =>
  console.log(`fluxe @ http://localhost:${env.PORT} (node:http · backend: ${store.name} · env: ${env.NODE_ENV})`));
