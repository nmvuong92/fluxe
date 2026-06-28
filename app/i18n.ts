import { createI18n } from "@nmvuong92/fluxe";

export const i18n = createI18n({
  defaultLocale: "vi",
  catalogs: {
    vi: {
      "greet.hello": "Xin chào, {name}!",
      "greet.desc": "i18n: locale giải từ cookie / Accept-Language; đổi qua ?locale=xx.",
      "home.title": "fluxe — fullstack tối giản",
      "home.backend": "Backend đang chạy: {name}",
      "home.static": "Trang này render server, không gửi JS (hydration: static).",
      "home.cta": "Tới /todos (island) →",
    },
    en: {
      "greet.hello": "Hello, {name}!",
      "greet.desc": "i18n: locale resolved from cookie / Accept-Language; switch via ?locale=xx.",
      "home.title": "fluxe — minimal fullstack",
      "home.backend": "Backend running: {name}",
      "home.static": "This page is server-rendered, ships no JS (hydration: static).",
      "home.cta": "Go to /todos (island) →",
    },
  },
});
