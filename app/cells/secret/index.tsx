import { defineCell } from "../../../src/core/engine";
import { Secret, type SecretData } from "./view";

export default defineCell<{}, SecretData>({
  id: "secret",
  route: "/secret",
  hydration: "static",
  requireAuth: true,            // guard: chưa đăng nhập → 401
  async loader({ session }) {
    return { user: session?.user ?? "?" };
  },
  view: Secret,
});
