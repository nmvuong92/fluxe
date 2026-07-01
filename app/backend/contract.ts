// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { todosContract } from "./modules/todos/todos.contract.ts";

// Static spread contract các module → createHooks<typeof contract>() suy type ở frontend
// (import type-only → 0 Zod schema xuống browser). Thêm module = spread thêm ở đây.
export const contract = { ...todosContract };
