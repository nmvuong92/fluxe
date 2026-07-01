// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { f } from "@nmvuong92/fluxe";

const Todo = f.object({ id: f.string, title: f.string, done: f.bool });

export const todosContract = f.contract({
  listTodos: f.query(Todo.array()),
  addTodo: f.mutation({ title: f.string }, Todo),
  toggleTodo: f.mutation({ id: f.string }, Todo.nullable()),
  onTodos: f.subscription(Todo.array()),
});
