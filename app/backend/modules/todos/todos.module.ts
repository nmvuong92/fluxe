// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineModule } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./api/contract.ts";
import { cleanTitle } from "./domain/rules.ts";

// ENTRY: mở file này hiểu cả module. Resolver KHAI BÁO — ctx.db tiêm qua `use` (0 make, 0 thread).
export default defineModule<{ db: TodoStore }>({
  name: "todos",
  contract: todosContract,
  use: { db: "backend" },                    // tiêm capability "backend" → ctx.db (typed TodoStore)
  resolvers: {
    listTodos: (_, { db }) => db.list(),
    addTodo: async ({ title }: { title: string }, { db, publish }) => { const t = await db.add(cleanTitle(title)); publish("onTodos", await db.list()); return t; },
    toggleTodo: async ({ id }: { id: string }, { db, publish }) => { const t = await db.toggle(id); publish("onTodos", await db.list()); return t; },
  },
});
