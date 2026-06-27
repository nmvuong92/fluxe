import { defineCell } from "../../cell";
import { Secret } from "./view";

export default defineCell({
  id: "secret",
  route: "/secret",
  hydration: "static",
  requireAuth: true,            // guard: chưa đăng nhập → 401
  async loader({ session }) {
    return { user: session?.user ?? "?" };
  },
  view: Secret,
});
