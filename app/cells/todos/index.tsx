import { z } from "zod";
import { defineCell } from "../../cell";   // ctx.backend có kiểu (factory) + ctx.input suy từ route
import { withInput } from "../../../src/core/validate";
import { Todos } from "./view";

export default defineCell({
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
