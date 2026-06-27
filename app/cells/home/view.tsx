import { createElement as h } from "react";

export interface HomeData { title: string; backendName: string }

export function Home({ data }: { data: HomeData }) {
  return h("div", { className: "card" },
    h("h1", null, data.title),
    h("p", { className: "muted" }, `Backend đang chạy: ${data.backendName}`),
    h("p", null, "Trang này render server, ", h("b", null, "không gửi JS"), " (hydration: static)."),
    h("a", { href: "/todos", className: "btn" }, "Tới /todos (island) →")
  );
}

export default Home;
