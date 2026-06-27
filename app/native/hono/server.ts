// fluxe backend — service Hono THẬT (Node runtime qua @hono/node-server).
// Cùng "hợp đồng" với interface Backend: list / add / toggle todo.
// Chạy: cd app/native/hono && npm i && PORT=8084 npm start
import { Hono } from "hono";
import { serve } from "@hono/node-server";

interface Todo { id: string; title: string; done: boolean }
const todos: Todo[] = [];
let seq = 0;

const app = new Hono();

app.get("/todos", (c) => c.json(todos));

app.post("/todos", async (c) => {
  const { title } = await c.req.json<{ title: string }>();
  seq++;
  const t: Todo = { id: `hn${seq}`, title: `[Hono] ${title}`, done: false };
  todos.push(t);
  return c.json(t);
});

app.post("/todos/:id/toggle", (c) => {
  const id = c.req.param("id");
  for (const t of todos) if (t.id === id) t.done = !t.done;
  return c.json(todos);
});

const port = Number(process.env.PORT ?? 8084);
console.log(`[hono backend] listening on :${port}`);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
