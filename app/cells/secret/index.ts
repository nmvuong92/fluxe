import { createElement as h } from "react";
import { defineCell } from "../../../src/core/engine";

interface SecretData { user: string }

export default defineCell<{}, SecretData>({
  id: "secret",
  route: "/secret",
  hydration: "static",
  requireAuth: true,            // guard: chưa đăng nhập → 401
  async loader({ session }) {
    return { user: session?.user ?? "?" };
  },
  view: ({ data }) =>
    h("div", { className: "card" },
      h("h1", null, "Khu vực bí mật"),
      h("p", null, `Chào ${data.user} — bạn đã đăng nhập.`),
      h("a", { href: "/logout", className: "muted" }, "Đăng xuất")
    ),
});
