// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* createApp — thin composer gom plugin (cells/contract/resolvers/commands) + capability DI + boot,
 * rồi gọi xuống createHandler. Xem spec: docs/superpowers/specs/2026-07-01-fluxe-plugin-ecosystem-design.md */
import type { Plugin, AppContext } from "./plugin.ts";
import { createHandler, type MakeServerOpts, type NodeHandler } from "../server_factory.ts";
import type { ResolutionManifest } from "./resolver.ts";

export interface CreateAppOpts extends MakeServerOpts {
  plugins?: Plugin[];
  manifest?: ResolutionManifest;   // nếu có → dựng handler (thin composer trên createHandler)
  layouts?: Record<string, any>;
  cells?: any[];                   // page cells nền (vd @frontend/registry) — plugin cells gộp thêm
}

export interface App {
  cells: any[];
  contract: Record<string, any>;
  resolvers: Record<string, any>;
  commands: any[];
  use<T>(cap: string): T;
  dispose(): Promise<void>;        // chạy teardown mọi plugin (ngược thứ tự topo)
  [Symbol.asyncDispose](): Promise<void>;   // `await using app = await createApp(...)`
  handler?: NodeHandler;           // có khi truyền manifest — mount lên Fastify/Express
}

/* Sắp plugin theo phụ thuộc capability (provider trước consumer) — Kahn's topological sort.
 * Edge: consumer --needs--> provider. Trả thứ tự boot an toàn. */
function topoSort(plugins: Plugin[], ambient: Set<string>): Plugin[] {
  const providerOf = new Map<string, string>();   // capability → plugin.name
  for (const p of plugins)
    for (const cap of p.provides ?? []) providerOf.set(cap, p.name);

  const deps = new Map<string, Set<string>>();    // plugin.name → tập plugin.name phụ thuộc
  for (const p of plugins) {
    const set = new Set<string>();
    for (const cap of p.needs ?? []) {
      const owner = providerOf.get(cap);
      if (!owner) {
        if (ambient.has(cap)) continue;   // core cung cấp (vd backend) → không cần plugin provide
        throw new Error(`[app] plugin ${p.name} cần capability "${cap}" nhưng không plugin nào provide`);
      }
      if (owner !== p.name) set.add(owner);
    }
    deps.set(p.name, set);
  }

  const order: Plugin[] = [];
  const done = new Set<string>();
  while (order.length < plugins.length) {
    const ready = plugins.filter((p) => !done.has(p.name) && [...deps.get(p.name)!].every((d) => done.has(d)));
    if (ready.length === 0) throw new Error("[app] vòng lặp phụ thuộc capability giữa plugin (cycle)");
    for (const p of ready) { order.push(p); done.add(p.name); }
  }
  return order;
}

export async function createApp(opts: CreateAppOpts = {}): Promise<App> {
  const plugins = opts.plugins ?? [];
  const cells: any[] = [];
  const seenId = new Map<string, string>();   // cell.id → nguồn (chống đụng namespace)
  for (const c of opts.cells ?? []) {         // page cells nền (frontend registry)
    seenId.set(c.id, "app");
    cells.push(c);
  }
  for (const p of plugins) {
    for (const c of p.cells ?? []) {
      const prev = seenId.get(c.id);
      if (prev) throw new Error(`[app] trùng cell id "${c.id}": ${prev} vs ${p.name}`);
      seenId.set(c.id, p.name);
      cells.push(c);
    }
  }

  const contract: Record<string, any> = {};
  const resolvers: Record<string, any> = {};
  const opOwner = new Map<string, string>();   // op name → plugin.name
  for (const p of plugins) {
    for (const [op, def] of Object.entries(p.contract ?? {})) {
      const prev = opOwner.get(op);
      if (prev) throw new Error(`[app] trùng op "${op}": ${prev} vs ${p.name}`);
      opOwner.set(op, p.name);
      contract[op] = def;
    }
    Object.assign(resolvers, p.resolvers ?? {});
  }

  // Capability DI: boot plugin theo thứ tự topo (provider trước consumer).
  const registry = new Map<string, unknown>();
  const ambient = new Set<string>();               // capability core cung cấp sẵn (không cần plugin)
  if (opts.backend !== undefined) { registry.set("backend", opts.backend); ambient.add("backend"); }
  const ctx: AppContext = {
    provide(cap, impl) { registry.set(cap, impl); },
    use(cap) {
      if (!registry.has(cap)) throw new Error(`[app] capability "${cap}" chưa được provide`);
      return registry.get(cap) as any;
    },
    addResolvers(r) {
      for (const [op, fn] of Object.entries(r)) {
        if (op in resolvers) throw new Error(`[app] trùng resolver "${op}"`);
        resolvers[op] = fn;
      }
    },
  };
  const disposers: Array<() => void | Promise<void>> = [];   // theo thứ tự boot (topo)
  for (const p of topoSort(plugins, ambient)) {
    const d = await p.boot?.(ctx);
    if (typeof d === "function") disposers.push(d);
  }
  async function dispose() {
    for (let i = disposers.length - 1; i >= 0; i--) await disposers[i]();   // NGƯỢC topo
  }

  const commands: any[] = [];
  for (const p of plugins) commands.push(...(p.commands ?? []));

  // Thin composer: nếu có manifest → gọi createHandler với đóng góp đã gộp.
  const { plugins: _p, manifest, layouts, cells: _c, ...rest } = opts;
  const handler = manifest
    ? createHandler(manifest, cells, layouts ?? {}, { ...rest, contract, resolvers })
    : undefined;

  return { cells, contract, resolvers, commands, use: ctx.use, dispose, [Symbol.asyncDispose]: dispose, handler };
}
