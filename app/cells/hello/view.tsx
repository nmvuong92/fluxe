import { createElement as h } from "react";

export interface HelloData { name: string; backendName: string }

export function Hello({ data }: { data: HelloData }) {
  return h("div", { className: "card" },
    h("h1", null, `Xin chào, ${data.name}!`),
    h("p", { className: "muted" }, `Param route động — backend: ${data.backendName}`),
    h("a", { href: "/", className: "muted" }, "← về trang chủ")
  );
}

export default Hello;
