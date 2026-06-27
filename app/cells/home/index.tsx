import { defineCell } from "../../cell";
import { Home } from "./view";

export default defineCell({
  id: "home",
  route: "/",
  hydration: "static",   // trang giới thiệu, không cần JS
  async loader({ backend }) {
    return { title: "fluxe — fullstack tối giản", backendName: backend.name };
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
