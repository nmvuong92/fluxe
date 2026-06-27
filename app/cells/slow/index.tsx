import { defineCell } from "../../cell";
import { SlowView, delay } from "./view";

export default defineCell({
  id: "slow",
  route: "/slow",
  hydration: "static",
  cache: false,            // STREAM (Suspense) → không render-cache để giữ TTFB streaming
  async loader() {
    return { slow: delay(150, "nội dung chậm đã stream xong") }; // KHÔNG await → suspend khi render
  },
  view: SlowView,
});
