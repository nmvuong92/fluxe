import { createElement as h } from "react";
import { defineCell } from "../../core/engine";

interface HomeData { title: string; backendName: string }

export default defineCell<{}, HomeData>({
  id: "home",
  route: "/",
  hydration: "static",   // trang giới thiệu, không cần JS
  async loader({ backend }) {
    return { title: "fluxe — fullstack tối giản", backendName: backend.name };
  },
  view: ({ data }) =>
    h("div", { className: "card" },
      h("h1", null, data.title),
      h("p", { className: "muted" }, `Backend đang chạy: ${data.backendName}`),
      h("p", null, "Trang này render server, ", h("b", null, "không gửi JS"), " (hydration: static)."),
      h("a", { href: "/todos", className: "btn" }, "Tới /todos (island) →")
    ),
});
