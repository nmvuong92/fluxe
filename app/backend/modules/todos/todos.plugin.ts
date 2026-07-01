// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { definePlugin } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./todos.contract.ts";
import { makeTodosResolvers } from "./todos.resolvers.ts";

/* Module = local plugin: gói contract + resolvers. createApp({plugins}) ghép. */
export function todosPlugin(store: TodoStore) {
  return definePlugin({
    name: "@app/todos",
    contract: todosContract,
    resolvers: makeTodosResolvers(store),
  });
}
