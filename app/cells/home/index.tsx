import { defineCell } from "../../../src/core/engine";
import { Home, type HomeData } from "./view";

export default defineCell<{}, HomeData>({
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
