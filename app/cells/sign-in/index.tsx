import { defineCell } from "../../cell";
import { SignIn } from "./view";

export default defineCell({
  id: "sign-in",
  route: "/sign-in",
  layout: "site",
  async loader() { return {}; },
  head: () => ({ title: "Đăng nhập — Bidly" }),
  view: SignIn,
});
