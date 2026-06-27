import { defineCell } from "../../cell";
import { Admin } from "./view";

export default defineCell({
  id: "admin",
  route: "/admin",
  hydration: "static",
  requireAuth: true,
  requireRole: "admin",          // RBAC: chỉ role admin
  async loader({ session }) {
    return { user: session?.user ?? "?", roles: (session?.roles as string[]) ?? [] };
  },
  view: Admin,
});
