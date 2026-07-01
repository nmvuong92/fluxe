// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineModule } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { todosContract } from "./api/contract.ts";
import { makeTodosResolvers } from "./api/resolver.ts";

// ENTRY: mở file này hiểu cả module. Core tự wire — resolvers nhận backend qua DI (needs "backend").
export default defineModule({
  name: "todos",
  contract: todosContract,
  needs: ["backend"],
  resolvers: (app) => makeTodosResolvers(app.use<TodoStore>("backend")),
});
