// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* @nmvuong92/fluxe — entry ENGINE = CẦU NỐI RCA (cells/SSR + contract/rpc).
 * Auth/csrf/ratelimit/storage/jobs/DI = việc của HOST framework + ecosystem, KHÔNG có trong fluxe.
 * Subpath: /react (DX React), /client (rpc runtime), /express·/fastify (adapter). */
export * from "./core/engine.ts";        // defineCell, Ctx, CellDef, Loader, Action, Hydration, Session
export * from "./core/validate.ts";      // validateInput, withInput
export * from "./core/errors.ts";        // FluxeError, ErrorPayload, toErrorPayload, renderErrorPage
export * from "./core/resolver.ts";      // resolve, ResolutionProfile/Manifest, CellDecl, RenderMode…
export * from "./core/cookie.ts";        // parseCookie (đọc cookie locale/theme)
export * from "./core/env.ts";           // loadEnv
export * from "./core/config.ts";        // FluxeConfig, loadConfig
export * from "./core/i18n.ts";          // createI18n, resolveLocale, translate, makeT, t(key, vars)
export * from "./core/seo.ts";           // renderHead, renderSitemap, renderRobots, HeadMeta
export * from "./core/broker.ts";        // realtime pub/sub (RCA live-update)
export * from "./core/presence.ts";      // ai online theo topic
export * from "./core/standard.ts";      // StandardSchemaV1, InferInput/Output, validateStandard (nhận mọi validator)
export * from "./core/contract.ts";      // f (builder), Contract, OpDef, Resolvers, Client, Infer
export * from "./core/layouts.ts";       // layoutChain, LayoutMeta
export * from "./core/router.ts";        // makeRouter
export { makeServer, createHandler, type NodeHandler, type MakeServerOpts } from "./server_factory.ts";
export * from "./core/plugin.ts";        // definePlugin, Plugin, Capability, AppContext (ecosystem @fluxe/*)
export * from "./core/app.ts";           // createApp — thin composer gom plugin → createHandler
// Backend (data) + auth/csrf/ratelimit/storage/jobs = USER-OWNED / HOST framework — fluxe không ship.
