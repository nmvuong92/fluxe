import { defineCell } from "../../cell";
import { SignUp } from "./view";

export default defineCell({
  id: "sign-up",
  route: "/sign-up",
  layout: "site",
  async loader() { return {}; },
  head: () => ({ title: "Đăng ký — Bidly" }),
  view: SignUp,
});
