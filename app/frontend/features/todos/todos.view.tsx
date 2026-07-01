// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { Link } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
export interface TodosData { todos: { id: string; title: string; done: boolean }[] }
export function Todos({ data }: { data: TodosData }) {
  const q = api.listTodos.useQuery({ initial: data.todos });
  const form = api.addTodo.useForm({ invalidates: ["listTodos"], onSuccess: () => form.reset() });
  const toggle = api.toggleTodo.useMutation({ invalidates: ["listTodos"] });
  api.onTodos.useSubscription(() => q.refetch());
  const todos = q.data ?? [];
  const title = form.register("title");
  const busy = form.submitting || toggle.loading || q.loading;
  return (
    <div className="card">
      <h1>Todos (island)</h1>
      <form className="row" onSubmit={form.handleSubmit}>
        <input {...title} placeholder="Việc mới..." disabled={busy} /><button type="submit" disabled={busy}>Thêm</button>
      </form>
      {form.errors.title ? <p style={{ color: "crimson" }}>{form.errors.title}</p> : null}
      <ul className="list">
        {todos.map((t) => (<li key={t.id} onClick={() => toggle.mutate({ id: t.id })} className={t.done ? "done" : ""}><span>{t.done ? "✓" : "○"}</span> {t.title}</li>))}
      </ul>
      <Link href="/" className="muted">← trang chủ (SPA nav)</Link>
    </div>
  );
}
export default Todos;
