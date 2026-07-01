// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineModule } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./contract.ts";

// ENTRY: mở file này hiểu cả module. Resolver KHAI BÁO — ctx.db (repository) tiêm qua `use` (0 make/thread).
// Phức tạp lên? tách domain/rules.ts · application/*.usecase.ts — xem guides/data-layer (promotion path).
export default defineModule<{ db: TodoStore }>({
  name: "todos",
  contract: todosContract,
  use: { db: "backend" },
  resolvers: {
    listTodos: (_, { db }) => db.list(),
    addTodo: async ({ title }: { title: string }, { db, publish }) => { const t = await db.add(title.trim()); publish("onTodos", await db.list()); return t; },
    toggleTodo: async ({ id }: { id: string }, { db, publish }) => { const t = await db.toggle(id); publish("onTodos", await db.list()); return t; },
  },
});
