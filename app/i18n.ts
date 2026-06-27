import { createI18n } from "@nmvuong92/fluxe";

export const i18n = createI18n({
  defaultLocale: "vi",
  catalogs: {
    vi: {
      "greet.hello": "Xin chào, {name}!",
      "greet.desc": "i18n: locale giải từ cookie / Accept-Language; đổi qua ?locale=xx.",
    },
    en: {
      "greet.hello": "Hello, {name}!",
      "greet.desc": "i18n: locale resolved from cookie / Accept-Language; switch via ?locale=xx.",
    },
  },
});
