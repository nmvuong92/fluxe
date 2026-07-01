// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import http from "node:http";
import { createApp, resolve } from "@nmvuong92/fluxe";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { i18n } from "@frontend/i18n";
import { profiles } from "@frontend/profiles";
import { makeDb } from "@backend/db";
import todos from "@backend/modules/todos/todos.module.ts";
export async function startTestServer() {
  const store = makeDb();
  const decls = cells.map((c) => ({ id: c.id, route: c.route, hydration: c.hydration }));
  const manifest = resolve(decls, profiles.dev);
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todos], backend: store });
  const server = http.createServer(app.handler!);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  return { port, store, close: () => new Promise<void>((r) => server.close(() => r())) };
}
