// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract codegen — app/contract.ts → .fluxe/gen/{types,validators,server,client}.ts.
 * Chạy tự động trong `fx sync` (mọi dev/resolve/build) + npm `prepare`. Dev không gõ tay. */
import { writeFileSync, mkdirSync } from "node:fs";
import { genContractTypes, genZod, genServer, genClient } from "../src/core/contract";
import { contract } from "../app/contract";

mkdirSync(".fluxe/gen", { recursive: true });
const banner = "// AUTO-GENERATED từ app/contract.ts — đừng sửa tay.\n";
writeFileSync(".fluxe/gen/types.ts", banner + genContractTypes(contract));
writeFileSync(".fluxe/gen/validators.ts", banner + genZod(contract));
writeFileSync(".fluxe/gen/server.ts", banner + genServer(contract));
writeFileSync(".fluxe/gen/client.ts", banner + genClient(contract));
console.log("[contract] .fluxe/gen/{types,validators,server,client}.ts");
