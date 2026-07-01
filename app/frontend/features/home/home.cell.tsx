// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import { Home } from "./home.view";

export default defineCell({
  id: "home",
  route: "/",
  hydration: "static",   // trang giới thiệu — 0 JS; i18n dịch trong loader (server)
  layout: "site",
  async loader({ t }) {
    return { title: t!("home.title"), cta: t!("home.cta") };
  },
  head: (data) => ({ title: data.title }),
  view: Home,
});
