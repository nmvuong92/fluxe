import { createElement as h, useState, useEffect } from "react";
import { rpc, subscribe } from "../../../src/core/client";
import { useQuery, useMutation, Link } from "../../../src/react";
import type { Todo } from "../../../src/backends/types";

export interface TodosData { todos: Todo[]; backendName: string }

export function Todos({ data }: { data: TodosData }) {
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
    h(Link, { href: "/", className: "muted" }, "← về trang chủ (SPA nav)")
  );
}

export default Todos;
