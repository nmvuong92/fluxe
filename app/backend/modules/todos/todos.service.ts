// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import type { TodoStore } from "@backend/db";
export function makeTodosService(store: TodoStore) {
  return { list: () => store.list(), add: (title: string) => store.add(title.trim()), toggle: (id: string) => store.toggle(id) };
}
