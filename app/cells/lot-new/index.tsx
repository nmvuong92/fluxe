import { defineCell } from "../../cell";
import { NewLot } from "./view";

export default defineCell({
  id: "lot-new",
  route: "/lots/new",
  layout: "site",
  requireRole: "seller",   // guard: chỉ seller (đọc session host gắn) — chưa đủ quyền → 403
  async loader() { return {}; },
  head: () => ({ title: "Tạo phiên đấu giá" }),
  view: NewLot,
});
