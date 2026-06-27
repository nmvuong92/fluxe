// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { readFileSync } from "node:fs";
import { makeServer } from "./server_factory";
import { createLocalStorage } from "./storage/local";
import type { ResolutionManifest } from "./core/resolver";
import { env } from "../app/env";   // validate env fail-fast lúc boot
import { cells } from "../app/app";  // registry cell phía app (DI vào engine)
import { layouts } from "../app/layouts/index";
import { i18n } from "../app/i18n";
import { backend } from "../app/backend";   // tầng data user-owned (DI vào engine)

const manifest: ResolutionManifest = JSON.parse(readFileSync(".fluxe/resolution.json", "utf8"));
const storage = createLocalStorage({ dir: ".fluxe/uploads" });
makeServer(manifest, cells, layouts, { i18n, storage, backend }).listen(env.PORT, () =>
  console.log(`fluxe @ http://localhost:${env.PORT} (profile: ${manifest.profile}, backend: ${backend.name}, env: ${env.NODE_ENV})`));
