import { createElement as h } from "react";
import { defineCell } from "../../core/engine";

interface HelloData { name: string; backendName: string }

export default defineCell<{ name: string }, HelloData>({
  id: "hello",
  route: "/hello/[name]",
  hydration: "static",   // trang chào, không cần JS
  async loader({ input, backend }) {
    return { name: input.name, backendName: backend.name };
  },
  view: ({ data }) =>
    h("div", { className: "card" },
      h("h1", null, `Xin chào, ${data.name}!`),
      h("p", { className: "muted" }, `Param route động — backend: ${data.backendName}`),
      h("a", { href: "/", className: "muted" }, "← về trang chủ")
    ),
});
