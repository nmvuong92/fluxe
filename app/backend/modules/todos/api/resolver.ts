// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { Resolvers } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./contract.ts";
import { makeTodosService } from "../domain/service.ts";
export function makeTodosResolvers(store: TodoStore): Resolvers<typeof todosContract> {
  const svc = makeTodosService(store);
  return {
    listTodos: () => svc.list(),
    addTodo: async ({ title }, ctx) => { const t = await svc.add(title); ctx.publish("onTodos", await svc.list()); return t; },
    toggleTodo: async ({ id }, ctx) => { const t = await svc.toggle(id); ctx.publish("onTodos", await svc.list()); return t; },
  };
}
