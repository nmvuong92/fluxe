import { defineCell } from "@nmvuong92/fluxe";
import { Greet, type GreetData } from "./view";

export default defineCell<{}, GreetData>({
  id: "greet",
  route: "/greet",
  hydration: "static",          // static + i18n: dịch trong loader (server) → 0 JS vẫn đa ngôn ngữ
  layout: "site",
  async loader({ t, locale }) {
    return {
      greeting: t!("greet.hello", { name: "fluxe" }),
      desc: t!("greet.desc"),
      locale: locale!,
    };
  },
  head: (d) => ({ title: d.greeting }),
  view: Greet,
});
