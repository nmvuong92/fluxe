// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* @nmvuong92/fluxe — entry ENGINE (server-side, không kéo node:sqlite).
 * Subpath: /react (DX React), /client (rpc runtime), /jobs, /sqlite (cần node:sqlite). */
export * from "./core/engine.ts";        // defineCell, Ctx, CellDef, Loader, Action, Hydration
export * from "./core/validate.ts";      // validateInput, withInput
export * from "./core/errors.ts";        // FluxeError, ErrorPayload, toErrorPayload, renderErrorPage
export * from "./core/resolver.ts";      // resolve, ResolutionProfile/Manifest, CellDecl, RenderMode…
export * from "./core/wiring.ts";        // backendFromManifest, backendsFromManifest
export * from "./core/auth.ts";          // session HMAC, scrypt password, CSRF, RBAC
export * from "./core/env.ts";           // loadEnv
export * from "./core/config.ts";        // FluxeConfig, loadConfig (default ← ENV FLUXE_* ← override)
export * from "./core/i18n.ts";          // createI18n, resolveLocale, translate, makeT, t(key, vars)
export * from "./core/seo.ts";           // renderHead, renderSitemap, renderRobots, HeadMeta
export * from "./core/broker.ts";        // pub/sub
export * from "./core/presence.ts";      // ai online theo topic
export * from "./core/ratelimit.ts";     // token-bucket + LRU
export * from "./core/codegen.ts";       // genTS/genGo/genRust
export * from "./core/layouts.ts";       // layoutChain, LayoutMeta
export * from "./core/router.ts";        // makeRouter
export * from "./core/testing.ts";       // createTestBackend
export * from "./backends/types.ts";     // Backend, Todo
export * from "./storage/types.ts";      // Storage, PutResult, GetResult, safeKey, makeKey
export { createMemoryStorage } from "./storage/memory.ts";
export { createLocalStorage } from "./storage/local.ts";
export { createS3Storage } from "./storage/s3.ts";   // adapter tham chiếu (cần @aws-sdk/client-s3)
export { createMemoryBackend } from "./backends/memory.ts";
export { createHttpBackend } from "./backends/http.ts";
export { createPostgresBackend } from "./backends/postgres.ts";
export { makeServer } from "./server_factory.ts";
