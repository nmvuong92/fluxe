// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fluxe Plugin Ecosystem — nền `definePlugin` + `createApp`. Batteries (`@fluxe/*`) cắm vào đây,
 * KHÔNG vào core. Xem spec: docs/superpowers/specs/2026-07-01-fluxe-plugin-ecosystem-design.md */

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

/* defineModule — sugar cho feature-module: đẩy WIRING vào core. `resolvers` có thể là FACTORY
 * (ctx) => resolvers → nhận capability qua DI (vd backend) trong boot, KHÔNG thread tay. Trả Plugin. */
export interface Module extends Omit<Plugin, "resolvers"> {
  resolvers?: Record<string, any> | ((app: AppContext) => Record<string, any>);
}
export function defineModule(m: Module): Plugin {
  const { resolvers, boot, ...rest } = m;
  return definePlugin({
    ...rest,
    async boot(app) {
      const dispose = typeof boot === "function" ? await boot(app) : undefined;   // boot của user (nếu có)
      if (resolvers) app.addResolvers(typeof resolvers === "function" ? resolvers(app) : resolvers);
      return dispose;
    },
  });
}
