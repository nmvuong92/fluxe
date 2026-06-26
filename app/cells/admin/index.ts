import { createElement as h } from "react";
import { defineCell } from "../../../src/core/engine";

interface AdminData { user: string; roles: string[] }

export default defineCell<{}, AdminData>({
  id: "admin",
  route: "/admin",
  hydration: "static",
  requireAuth: true,
  requireRole: "admin",          // RBAC: chỉ role admin
  async loader({ session }) {
    return { user: session?.user ?? "?", roles: (session?.roles as string[]) ?? [] };
  },
  view: ({ data }) =>
    h("div", { className: "card" },
      h("h1", null, "Trang quản trị"),
      h("p", null, `Admin: ${data.user} — roles: ${data.roles.join(", ")}`)
    ),
});
