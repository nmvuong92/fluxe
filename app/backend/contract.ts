// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { todosContract } from "./modules/todos/api/contract.ts";
// Static spread → createHooks<typeof contract>() suy type ở frontend. Thêm module = spread thêm.
export const contract = { ...todosContract };
