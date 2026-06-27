import { defineCell } from "../../../src/core/engine";
import { Admin, type AdminData } from "./view";

export default defineCell<{}, AdminData>({
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
