import { z } from "zod";
import { defineCell } from "../../../src/core/engine";
import { withInput } from "../../../src/core/validate";
import type { Backend } from "../../backend";   // backend domain của app → ctx.backend có kiểu
import { Todos, type TodosData } from "./view";

// Tham số thứ 3 = kiểu backend của app → ctx.backend.listTodos() được gợi ý + check kiểu.
export default defineCell<{}, TodosData, Backend>({
  id: "todos",
  route: "/todos",
  hydration: "island",
  layout: "app",
  async loader({ backend }) {
    return { todos: await backend.listTodos(), backendName: backend.name };
  },
  actions: {
    list: async ({ backend }) => backend.listTodos(),
    add: withInput(
      z.object({ title: z.string().min(1, "Tiêu đề không được rỗng").max(200) }),
      async ({ input, backend }) => backend.addTodo(input.title),
    ),
    toggle: withInput(
      z.object({ id: z.string().min(1) }),
      async ({ input, backend }) => backend.toggleTodo(input.id),
    ),
  },
  view: Todos,
});
