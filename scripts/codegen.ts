/* Sinh types từ contract cho cả 3 ngôn ngữ → .fluxe/gen/. */
import { writeFileSync, mkdirSync } from "node:fs";
import { genTS, genGo, genRust } from "../src/core/codegen";
import { contract } from "../app/contract";

mkdirSync(".fluxe/gen", { recursive: true });
const banner = "// CODE SINH TỰ ĐỘNG từ app/contract.ts — đừng sửa tay.\n";

writeFileSync(".fluxe/gen/types.ts", banner + genTS(contract));
writeFileSync(".fluxe/gen/contract.go", "// " + banner.slice(3) + genGo(contract));
writeFileSync(".fluxe/gen/contract.rs", banner + genRust(contract));
writeFileSync(".fluxe/gen/go.mod", "module fluxe/gen\n\ngo 1.22\n"); // để go build kiểm tra được

console.log("[codegen] .fluxe/gen/: types.ts · contract.go · contract.rs (từ 1 schema)");
