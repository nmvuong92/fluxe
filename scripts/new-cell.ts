// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx new <id> [--island] — scaffold cell theo cấu trúc tách view/cell (như SvelteKit/Astro):
 *   view.tsx   = giao diện thuần (React component + kiểu data)
 *   index.tsx  = cell: route/hydration/layout/loader/actions/head, gắn view
 * Sau đó sync (auto-discovery đăng ký). Static (mặc định) hoặc island (--island). */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const isStatic = args.includes("--static");   // mặc định island; --static để opt-in 0-JS
const id = args.find((a) => !a.startsWith("--"));

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error("Dùng: fx new <id> [--static]   (id: chữ thường, vd 'tasks', 'about-us')");
  process.exit(1);
}

const dir = join("app/cells", id);
if (existsSync(dir)) {
  console.error(`Cell '${id}' đã tồn tại: ${dir}`);
  process.exit(1);
}

const Comp = id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());   // tasks → Tasks

// ---- STATIC ----
const staticView = `// view.tsx — GIAO DIỆN thuần (không server logic). Đây là chỗ designer/frontend sửa.
export interface ${Comp}Data {
  title: string;
}

export function ${Comp}({ data }: { data: ${Comp}Data }) {
  return (
    <div className="card">
      <h1>{data.title}</h1>
      <p>Trang static — 0 JS.</p>
    </div>
  );
}

export default ${Comp};   // client bundle import default (chỉ view, không server logic)
`;

const staticCell = `// index.tsx — CELL: route + server logic (loader/head), gắn view.
import { defineCell } from "../../cell";   // ctx.input suy từ route + ctx.backend có kiểu
import { ${Comp} } from "./view";

export default defineCell({
  id: "${id}",
  route: "/${id}",                          // có [param] → ctx.input.<param> tự suy
  hydration: "static",
  layout: "site",
  async loader() {            // chạy SERVER → trả props cho view (O suy từ return)
    return { title: "${Comp}" };
  },
  head: (data) => ({ title: data.title }),
  view: ${Comp},
});
`;

// ---- ISLAND ----
const islandView = `// view.tsx — GIAO DIỆN island: state + useQuery/useMutation. Không chứa loader/actions server.
import { useState } from "react";
import { rpc } from "@nmvuong92/fluxe/client";
import { useQuery, useMutation } from "@nmvuong92/fluxe/react";
import type { Todo } from "@nmvuong92/fluxe";

export interface ${Comp}Data {
  items: Todo[];
}

export function ${Comp}({ data }: { data: ${Comp}Data }) {
  const { data: items, refetch } = useQuery("${id}", () => rpc<Todo[]>("${id}", "list", {}), {
    initial: data.items,
  });
  const add = useMutation("${id}.add", (title: string) => rpc("${id}", "add", { title }));
  const [title, setTitle] = useState("");

  async function onAdd() {
    await add.mutate(title);
    setTitle("");
    refetch();
  }

  return (
    <div className="card">
      <h1>${Comp}</h1>
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <button onClick={onAdd}>Thêm</button>
      {add.error && <p style={{ color: "red" }}>{add.error}</p>}
      <ul>
        {(items ?? []).map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>
    </div>
  );
}

export default ${Comp};   // client bundle import default (chỉ view, không server logic)
`;

const islandCell = `// index.tsx — CELL: route + loader + actions (server), gắn view.
import { z } from "zod";
import { defineCell } from "../../cell";   // ctx.input suy từ route + ctx.backend có kiểu
import { withInput } from "@nmvuong92/fluxe";
import { ${Comp} } from "./view";

export default defineCell({
  id: "${id}",
  route: "/${id}",
  layout: "site",                 // hydration mặc định "island" (interactive) — không cần khai báo
  async loader({ backend }) {
    return { items: await backend.listTodos() };
  },
  view: ${Comp},
  actions: {
    list: async ({ backend }) => backend.listTodos(),
    add: withInput(
      z.object({ title: z.string().min(1, "Không được rỗng").max(200) }),
      async ({ input, backend }) => backend.addTodo(input.title),
    ),
  },
});
`;

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "view.tsx"), isStatic ? staticView : islandView);
writeFileSync(join(dir, "index.tsx"), isStatic ? staticCell : islandCell);
console.log(`[new] tạo ${dir}/view.tsx + index.tsx (${isStatic ? "static" : "island"})`);
execSync("tsx scripts/sync.ts", { stdio: "inherit" });   // auto-discovery đăng ký ngay
console.log(`→ Chạy: npm run dev   rồi mở  http://localhost:5180/${id}`);
