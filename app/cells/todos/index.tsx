import { createElement as h, useState, useEffect } from "react";
import { z } from "zod";
import { defineCell } from "../../../src/core/engine";
import { withInput } from "../../../src/core/validate";
import { rpc, subscribe } from "../../../src/core/client";
import { useQuery, useMutation } from "../../../src/react";
import type { Todo } from "../../../src/backends/types";

interface TodosData { todos: Todo[]; backendName: string }

function View({ data }: { data: TodosData }) {
  const [title, setTitle] = useState("");

  // react-query-lite: list là nguồn sự thật DUY NHẤT. initial = data SSR (không flash).
  const q = useQuery<Todo[]>("todos", () => rpc("todos", "list", {}), { initial: data.todos });
  const add = useMutation("todos.add", (t: string) => rpc<Todo>("todos", "add", { title: t }));
  const toggle = useMutation("todos.toggle", (id: string) => rpc<Todo[]>("todos", "toggle", { id }));
  const todos = q.data ?? [];

  // Realtime: client khác đổi → revalidate.
  useEffect(() => subscribe("todos", () => q.refetch()), []);

  async function onAdd() {
    try { await add.mutate(title); setTitle(""); q.refetch(); } catch { /* lỗi đã ở add.error */ }
  }
  async function onToggle(id: string) {
    try { await toggle.mutate(id); q.refetch(); } catch { /* */ }
  }

  const err = add.error || toggle.error;
  const busy = add.loading || toggle.loading || q.loading;

  return h("div", { className: "card" },
    h("h1", null, "Todos (island)"),
    h("p", { className: "muted" }, `Backend: ${data.backendName} — useQuery/useMutation + DebugBar (góc dưới phải)`),
    h("div", { className: "row" },
      h("input", {
        value: title, placeholder: "Việc mới...", disabled: busy,
        onChange: (e: any) => setTitle(e.target.value),
        onKeyDown: (e: any) => e.key === "Enter" && onAdd(),
      }),
      h("button", { onClick: onAdd, disabled: busy }, "Thêm")
    ),
    err ? h("p", { className: "err", style: { color: "crimson" } }, err) : null,
    h("ul", { className: "list" },
      todos.map((t) =>
        h("li", { key: t.id, onClick: () => onToggle(t.id), className: t.done ? "done" : "" },
          h("span", { className: "check" }, t.done ? "✓" : "○"), " ", t.title)
      )
    ),
    h("a", { href: "/", className: "muted" }, "← về trang chủ")
  );
}

export default defineCell<{}, TodosData>({
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
  view: View,
});
