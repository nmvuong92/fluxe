import { defineCell } from "../../cell";
import { Home } from "./view";

export default defineCell({
  id: "home",
  route: "/",
  layout: "site",        // island (mặc định) → header (AuthStatus/NotifBell) hydrate được; i18n vẫn SSR

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
