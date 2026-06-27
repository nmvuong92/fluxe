// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Resolved Container — DI lười (lazy singleton). Register factory = O(1), KHÔNG instantiate;
 * get() tạo lần đầu rồi memoize. Factory tự c.get(dep) → DI + thứ tự init tự nhiên (DFS) +
 * phát hiện vòng (cycle). resolved() liệt kê token đã tạo → "chỉ module dùng mới bootstrap".
 * DSA: Map provider + Map instance (O(1)); Set "đang giải" (cycle, O(depth)). */

export type Factory<T> = (c: Container) => T;

export interface Container {
  register<T>(token: string, factory: Factory<T>): Container;
  override<T>(token: string, factory: Factory<T>): Container;
  has(token: string): boolean;
  get<T>(token: string): T;
  resolved(): string[];
}

export function createContainer(): Container {
  const providers = new Map<string, Factory<any>>();
  const instances = new Map<string, any>();
  const resolving = new Set<string>();   // DFS đang giải → bắt cycle

  const c: Container = {
    register(token, factory) {
      if (providers.has(token)) throw new Error(`Container: token '${token}' đã đăng ký (dùng override để ghi đè)`);
      providers.set(token, factory);
      return c;
    },
    override(token, factory) {
      providers.set(token, factory);
      instances.delete(token);   // buộc tạo lại lần get sau
      return c;
    },
    has: (token) => providers.has(token),
    get(token) {
      if (instances.has(token)) return instances.get(token);   // memoized singleton
      const f = providers.get(token);
      if (!f) throw new Error(`Container: chưa đăng ký token '${token}'`);
      if (resolving.has(token)) {
        throw new Error(`Container: phụ thuộc vòng (cycle) tại '${token}' — chuỗi: ${[...resolving, token].join(" → ")}`);
      }
      resolving.add(token);
      try {
        const inst = f(c);          // factory có thể c.get(dep) → DI lười, thứ tự tự nhiên
        instances.set(token, inst);
        return inst;
      } finally {
        resolving.delete(token);
      }
    },
    resolved: () => [...instances.keys()],
  };
  return c;
}
