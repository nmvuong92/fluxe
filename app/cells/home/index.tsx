import { defineCell } from "../../cell";
import { Home } from "./view";

export default defineCell({
  id: "home",
  route: "/",
  hydration: "static",   // trang giới thiệu, không cần JS — i18n dịch trong loader (server) vẫn đa ngôn ngữ
  layout: "site",        // có LocaleSwitch (VI/EN) ở header
  async loader({ backend, t }) {
    return {
      title: t!("home.title"),
      backend: t!("home.backend", { name: backend.name }),
      static: t!("home.static"),
      cta: t!("home.cta"),
      cta2: t!("home.cta2"),
    };
  },
  head: (data) => ({
    title: data.title,
    description: "Khung fullstack tối giản: SSR + island, một runtime TS.",
    canonical: "/",
    og: { title: data.title, type: "website" },
    jsonLd: { "@context": "https://schema.org", "@type": "WebSite", name: "fluxe" },
  }),
  view: Home,
});
