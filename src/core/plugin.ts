// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fluxe Plugin Ecosystem — nền `definePlugin` + `createApp`. Batteries (`@fluxe/*`) cắm vào đây,
 * KHÔNG vào core. Xem spec: docs/superpowers/specs/2026-07-01-fluxe-plugin-ecosystem-design.md */
import type { ResolverCtx } from "./contract.ts";

export const PLUGIN_API_VERSION = 1;

export type Capability = string;

/* Context tiêm vào plugin.boot() — DI capability (topo-sort đảm bảo provider boot trước). */
export interface AppContext {
  provide<T>(cap: Capability, impl: T): void;
  use<T>(cap: Capability): T;
  addResolvers(r: Record<string, any>): void;   // module đăng ký resolvers (sau khi DI sẵn sàng)
}

/* Teardown: boot() có thể trả hàm cleanup (đóng DB pool/worker…) — app.dispose() chạy NGƯỢC
 * thứ tự topo. Dùng `using`/`Symbol.asyncDispose`. */
export type Dispose = () => void | Promise<void>;

export interface Plugin {
  name: string;
  apiVersion?: number;              // mặc định = PLUGIN_API_VERSION; engine fail-fast nếu lệch
  needs?: Capability[];             // capability plugin cần (engine inject; quyết định thứ tự boot)
  provides?: Capability[];          // capability plugin đăng ký cho plugin khác
  cells?: any[];                    // đóng góp route/cell (CellDef)
  contract?: Record<string, any>;   // đóng góp op typed (Contract)
  resolvers?: Record<string, any>;  // handler cho op
  commands?: any[];                 // mở rộng CLI `fx`
  boot?(app: AppContext): void | Dispose | Promise<void | Dispose>;   // trả cleanup (tuỳ chọn)
}

export function definePlugin(p: Plugin): Plugin {
  if (!p.name) throw new Error("[plugin] thiếu `name` (bắt buộc — namespace cho cell/ENV/route)");
  const apiVersion = p.apiVersion ?? PLUGIN_API_VERSION;
  if (apiVersion !== PLUGIN_API_VERSION)
    throw new Error(`[plugin ${p.name}] apiVersion ${apiVersion} không hỗ trợ (core cần ${PLUGIN_API_VERSION})`);
  return { ...p, apiVersion };
}

/* defineModule — feature-module KHAI BÁO (bỏ make/thread). `use` tiêm capability vào ctx resolver
 * (vd `use:{db:"backend"}` → resolver nhận `ctx.db`); `resolvers` = object khai báo `(input,ctx)=>…`
 * HOẶC factory `(app)=>…`. `needs` tự suy từ `use`. Đẩy wiring vào core. Trả Plugin. */
export type ModuleResolver = (input: any, ctx: any) => any;
export interface Module<Inj = Record<string, unknown>> extends Omit<Plugin, "resolvers"> {
  use?: Record<keyof Inj & string, Capability>;   // ctx-key → capability name (tiêm vào ctx resolver)
  // resolver khai báo: ctx = ResolverCtx (session/publish/span) + Inj (vd { db }); input tự chú thích.
  resolvers?: Record<string, (input: any, ctx: ResolverCtx & Inj) => any> | ((app: AppContext) => Record<string, any>);
}

/* Bọc resolver khai báo: tiêm `use` vào ctx; input-aware (op có input → (input,ctx); không → (ctx)). */
function wrapResolvers(resolvers: Record<string, ModuleResolver>, use: Module["use"], contract: any, app: AppContext) {
  const injected = Object.fromEntries(Object.entries(use ?? {}).map(([k, cap]) => [k, app.use(cap as string)]));
  const out: Record<string, any> = {};
  for (const [op, fn] of Object.entries(resolvers)) {
    const hasInput = !!contract?.[op]?.input;
    out[op] = hasInput
      ? (input: any, ctx: any) => fn(input, { ...ctx, ...injected })
      : (ctx: any) => fn(undefined, { ...ctx, ...injected });
  }
  return out;
}

export function defineModule<Inj = Record<string, unknown>>(m: Module<Inj>): Plugin {
  const { resolvers, boot, use, needs, contract, ...rest } = m;
  const derivedNeeds = [...(needs ?? []), ...Object.values(use ?? {}) as Capability[]];
  return definePlugin({
    ...rest,
    contract,
    needs: derivedNeeds.length ? [...new Set(derivedNeeds)] : undefined,
    async boot(app) {
      const dispose = typeof boot === "function" ? await boot(app) : undefined;   // boot user (nếu có)
      if (resolvers) app.addResolvers(typeof resolvers === "function" ? resolvers(app) : wrapResolvers(resolvers, use, contract, app));
      return dispose;
    },
  });
}
