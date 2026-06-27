// Client API bind vào contract MỘT lần (như tRPC). Client-safe: contract import TYPE-ONLY
// → 0 Zod schema xuống browser. Cell/view import từ đây để gọi op + dùng hook typed.
import { createClient } from "@nmvuong92/fluxe/client";
import { createHooks } from "@nmvuong92/fluxe/react";
import type { AppContract } from "./contract";

export const client = createClient<AppContract>();   // await client.todos() — gọi /__rpc/<op>
export const api = createHooks<AppContract>();        // api.todos.useQuery() / api.addTodo.useForm()
