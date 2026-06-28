import { createI18n } from "@nmvuong92/fluxe";

export const i18n = createI18n({
  defaultLocale: "vi",
  catalogs: {
    vi: {
      "greet.hello": "Xin chào, {name}!",
      "greet.desc": "i18n: locale giải từ cookie / Accept-Language; đổi qua ?locale=xx.",
      "home.title": "Bidly — sàn đấu giá realtime (demo fluxe)",
      "home.backend": "Backend đang chạy: {name}",
      "home.static": "Auth · CRUD · realtime (SSE) · notification · job queue · WebSocket — tất cả bằng fluxe.",
      "home.cta": "🔨 Vào sàn đấu giá →",
      "home.cta2": "Demo todos (island) →",
    },
    en: {
      "greet.hello": "Hello, {name}!",
      "greet.desc": "i18n: locale resolved from cookie / Accept-Language; switch via ?locale=xx.",
      "home.title": "Bidly — realtime auction (fluxe demo)",
      "home.backend": "Backend running: {name}",
      "home.static": "Auth · CRUD · realtime (SSE) · notifications · job queue · WebSocket — all with fluxe.",
      "home.cta": "🔨 Enter the auction →",
      "home.cta2": "Todos demo (island) →",
    },
  },
});
