import { createElement as h, useState } from "react";
import { z } from "zod";
import { defineCell } from "../../../src/core/engine";
import { withInput } from "../../../src/core/validate";
import { rpc } from "../../../src/core/client";
import type { Todo } from "../../../src/backends/types";

interface TodosData { todos: Todo[]; backendName: string }

function View({ data }: { data: TodosData }) {
  const [todos, setTodos] = useState(data.todos);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!title.trim()) return;
    setBusy(true);
    const created: Todo = await rpc("todos", "add", { title });   // gọi action server
    setTodos((t) => [...t, created]);
    setTitle("");
    setBusy(false);
  }
  async function toggle(id: string) {
    setBusy(true);
    const next: Todo[] = await rpc("todos", "toggle", { id });
    setTodos(next);
    setBusy(false);
  }

  return h("div", { className: "card" },
    h("h1", null, "Todos (island)"),
    h("p", { className: "muted" }, `Backend: ${data.backendName} — logic chạy ở server qua interface chuẩn`),
    h("div", { className: "row" },
      h("input", {
        value: title, placeholder: "Việc mới...", disabled: busy,
        onChange: (e: any) => setTitle(e.target.value),
        onKeyDown: (e: any) => e.key === "Enter" && add(),
      }),
      h("button", { onClick: add, disabled: busy }, "Thêm")
    ),
    h("ul", { className: "list" },
      todos.map((t) =>
        h("li", { key: t.id, onClick: () => toggle(t.id), className: t.done ? "done" : "" },
          h("span", { className: "check" }, t.done ? "✓" : "○"), " ", t.title)
      )
    ),
    h("a", { href: "/", className: "muted" }, "← về trang chủ")
  );
}

export default defineCell<{}, TodosData>({
  id: "todos",
  route: "/todos",
  hydration: "island",   // có tương tác → hydrate
  layout: "app",         // bọc trong app → site (nested layout)
  async loader({ backend }) {
    return { todos: await backend.listTodos(), backendName: backend.name };
  },
  actions: {
    add: withInput(
      z.object({ title: z.string().min(1, "Tiêu đề không được rỗng").max(200) }),
      async ({ input, backend }) => backend.addTodo(input.title),
    ),
    toggle: withInput(
      z.object({ id: z.string().min(1) }),
      async ({ input, backend }) => backend.toggleTodo(input.id),
    ),
  },
  view: View,
});
