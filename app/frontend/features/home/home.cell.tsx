// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { defineCell } from "@nmvuong92/fluxe";
import { Home } from "./home.view";
export default defineCell({
  id: "home", route: "/", hydration: "static", layout: "site",
  async loader({ t }) { return { title: t!("home.title"), cta: t!("home.cta") }; },
  head: (d) => ({ title: d.title }), view: Home,
});
