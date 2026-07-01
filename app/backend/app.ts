// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { createApp, type ResolutionManifest } from "@nmvuong92/fluxe";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeDb } from "./db.ts";
import todos from "./modules/todos/todos.module.ts";   // thêm module = import + thêm vào plugins
export async function makeApp() {
  const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
  const store = makeDb();
  // backend auto-provide capability "backend" → module.needs ["backend"] tự nhận (không thread tay).
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todos], backend: store });
  return { app, store, manifest };
}
