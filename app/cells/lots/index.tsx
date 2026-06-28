import { defineCell } from "../../cell";
import { Lots } from "./view";

export default defineCell({
  id: "lots",
  route: "/lots",
  layout: "site",
  // loader chạy SERVER → gọi backend in-process (0 hop). View hydrate + live qua api.lots.useQuery.
  async loader({ backend }) {
    return { lots: await backend.listLots() };
  },
  head: () => ({ title: "Phiên đấu giá — Bidly", description: "Danh sách phiên đấu giá đang mở." }),
  view: Lots,
});
