import { useEffect } from "react";
import { subscribe } from "@nmvuong92/fluxe/client";
import { Link } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
import type { Todo } from "../../backend/data";   // type-only → esbuild elide, không kéo server code

export interface TodosData { todos: Todo[]; backendName: string }

export function Todos({ data }: { data: TodosData }) {
  // Contract-aware: bind vào op, typed tức thì. list = nguồn sự thật DUY NHẤT (initial = SSR, không flash).
  const q = api.todos.useQuery({ initial: data.todos });
  // useForm: field suy từ input op addTodo; lỗi validation server map về field; refetch todos sau khi thêm.
  const form = api.addTodo.useForm({ invalidates: ["todos"], onSuccess: () => form.reset() });
  // useMutation: optimistic + invalidate (refetch todos sau toggle).
  const toggle = api.toggleTodo.useMutation({ invalidates: ["todos"] });
  const todos = q.data ?? [];

  // Realtime: client khác đổi → refetch.
  useEffect(() => subscribe("todos", () => q.refetch()), []);

  const title = form.register("title");
  const busy = form.submitting || toggle.loading || q.loading;

  return (
    <div className="card">
      <h1>Todos (island)</h1>
      <p className="muted">Backend: {data.backendName} — createHooks (useQuery/useForm/useMutation) + DebugBar (góc dưới phải)</p>
      <form className="row" onSubmit={form.handleSubmit}>
        <input {...title} placeholder="Việc mới..." disabled={busy} />
        <button type="submit" disabled={busy}>Thêm</button>
      </form>
      {form.errors.title ? <p className="err" style={{ color: "crimson" }}>{form.errors.title}</p> : null}
      {form.formError || toggle.error ? <p className="err" style={{ color: "crimson" }}>{form.formError || toggle.error}</p> : null}
      <ul className="list">
        {todos.map((t) => (
          <li key={t.id} onClick={() => toggle.mutate({ id: t.id })} className={t.done ? "done" : ""}>
            <span className="check">{t.done ? "✓" : "○"}</span> {t.title}
          </li>
        ))}
      </ul>
      <Link href="/" className="muted">← về trang chủ (SPA nav)</Link>
    </div>
  );
}

export default Todos;
