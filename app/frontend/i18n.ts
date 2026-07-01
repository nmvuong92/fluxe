// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createI18n } from "@nmvuong92/fluxe";
export const i18n = createI18n({
  defaultLocale: "vi",
  catalogs: {
    vi: { "home.title": "fluxe starter", "home.cta": "Tới /todos →", "greet.hello": "Xin chào, {name}!", "greet.desc": "i18n: locale từ cookie / Accept-Language." },
    en: { "home.title": "fluxe starter", "home.cta": "Go to /todos →", "greet.hello": "Hello, {name}!", "greet.desc": "i18n: locale from cookie / Accept-Language." },
  },
});
