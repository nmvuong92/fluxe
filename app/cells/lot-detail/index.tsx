import { FluxeError } from "@nmvuong92/fluxe";
import { defineCell } from "../../cell";
import { LotDetail } from "./view";

export default defineCell({
  id: "lot-detail",
  route: "/lots/[id]",        // ctx.input.id: string (suy từ route, không khai báo)
  layout: "site",
  async loader({ input, backend }) {
    const lot = await backend.getLot(input.id);
    if (!lot) throw new FluxeError("not_found", "Không tìm thấy phiên", 404);
    return { lot, bids: await backend.listBids(input.id) };
  },
  head: (d) => ({ title: `${d.lot.title} — đấu giá` }),
  view: LotDetail,
});
