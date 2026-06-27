// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Sinh types TS từ contract → .fluxe/gen/. */
import { writeFileSync, mkdirSync } from "node:fs";
import { genTS } from "../src/core/codegen";
import { contract } from "../app/contract";

mkdirSync(".fluxe/gen", { recursive: true });
const banner = "// CODE SINH TỰ ĐỘNG từ app/contract.ts — đừng sửa tay.\n";

writeFileSync(".fluxe/gen/types.ts", banner + genTS(contract));

console.log("[codegen] .fluxe/gen/types.ts (từ 1 schema)");
