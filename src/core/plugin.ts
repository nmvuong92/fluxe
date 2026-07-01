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
}

export interface Plugin {
  name: string;
  apiVersion?: number;              // mặc định = PLUGIN_API_VERSION; engine fail-fast nếu lệch
  needs?: Capability[];             // capability plugin cần (engine inject; quyết định thứ tự boot)
  provides?: Capability[];          // capability plugin đăng ký cho plugin khác
  cells?: any[];                    // đóng góp route/cell (CellDef)
  contract?: Record<string, any>;   // đóng góp op typed (Contract)
  resolvers?: Record<string, any>;  // handler cho op
  commands?: any[];                 // mở rộng CLI `fx`
  boot?(app: AppContext): void | Promise<void>;
}

export function definePlugin(p: Plugin): Plugin {
  if (!p.name) throw new Error("[plugin] thiếu `name` (bắt buộc — namespace cho cell/ENV/route)");
  const apiVersion = p.apiVersion ?? PLUGIN_API_VERSION;
  if (apiVersion !== PLUGIN_API_VERSION)
    throw new Error(`[plugin ${p.name}] apiVersion ${apiVersion} không hỗ trợ (core cần ${PLUGIN_API_VERSION})`);
  return { ...p, apiVersion };
}
