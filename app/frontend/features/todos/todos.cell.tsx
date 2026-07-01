// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import type { TodoStore } from "@backend/db";
import { Todos } from "./todos.view";

export default defineCell({
  id: "todos",
  route: "/todos",
  layout: "site",        // island (mặc định)
  async loader({ backend }) {
    return { todos: await (backend as TodoStore).list() };
  },
  head: () => ({ title: "Todos" }),
  view: Todos,
});
