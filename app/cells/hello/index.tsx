import { defineCell } from "../../cell";   // typed routes + ctx.backend có kiểu
import { FluxeError } from "../../../src/core/errors";
import { Hello } from "./view";

export default defineCell({
  id: "hello",
  route: "/hello/[name]",                  // → ctx.input.name: string (tự suy, không khai báo)
  hydration: "static",   // trang chào, không cần JS
  async loader({ input, backend }) {
    if (input.name === "boom") throw new FluxeError("forbidden", "Không cho phép tên này", 403);
    if (input.name === "crash") throw new Error("nổ tung nội bộ");
    return { name: input.name, backendName: backend.name };
  },
  view: Hello,
});
