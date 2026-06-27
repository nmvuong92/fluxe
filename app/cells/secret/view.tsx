import { createElement as h } from "react";

export interface SecretData { user: string }

export function Secret({ data }: { data: SecretData }) {
  return h("div", { className: "card" },
    h("h1", null, "Khu vực bí mật"),
    h("p", null, `Chào ${data.user} — bạn đã đăng nhập.`),
    h("a", { href: "/logout", className: "muted" }, "Đăng xuất")
  );
}

export default Secret;
