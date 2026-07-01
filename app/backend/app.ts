// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { createApp, type ResolutionManifest } from "@nmvuong92/fluxe";
import { i18n } from "@frontend/i18n";
import { cells } from "@frontend/registry";
import { layouts } from "@frontend/layouts/index";
import { makeDb } from "./db.ts";
import { todosPlugin } from "./modules/todos/todos.plugin.ts";
export async function makeApp() {
  const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
  const store = makeDb();
  const app = await createApp({ manifest, cells, layouts, i18n, plugins: [todosPlugin(store)], backend: store });
  return { app, store, manifest };
}
