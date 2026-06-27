// defineCell BIND sẵn kiểu backend của app (một lần) — cells import từ đây để ctx.backend có kiểu,
// đồng thời ctx.input suy từ route + O suy từ loader. (Như tRPC initTRPC.)
import { createCells } from "@nmvuong92/fluxe";
import type { Backend } from "./backend/data";
import type { AppSession } from "./auth";

// bind backend + session một lần → ctx.input (route) + ctx.backend + ctx.session đều có kiểu.
export const defineCell = createCells<Backend, AppSession>();
