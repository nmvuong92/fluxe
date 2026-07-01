// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx openapi — cwd-relative: đọc contract của project → ghi .fluxe/openapi.json + bruno/ (collection
 * Bruno). Mở bruno/ bằng Bruno là chạy ngay. */
import { writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { toOpenApi } from "../src/openapi/openapi.ts";
import { toBruno } from "../src/openapi/bruno.ts";

const { contract } = await import(pathToFileURL(join(process.cwd(), "backend/contract.ts")).href);
const name = process.argv[2] ?? "fluxe API";
const baseUrl = process.env.FLUXE_OPENAPI_BASEURL ?? "http://localhost:5180";

mkdirSync(".fluxe", { recursive: true });
writeFileSync(".fluxe/openapi.json", JSON.stringify(toOpenApi(contract, { title: name }), null, 2) + "\n");

const files = toBruno(contract, { name, baseUrl });
for (const [rel, content] of Object.entries(files)) {
  const path = join("bruno", rel);
  mkdirSync(join("bruno", rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ""), { recursive: true });
  writeFileSync(path, content);
}
console.log(`[openapi] .fluxe/openapi.json + bruno/ (${Object.keys(files).length} file). Mở bruno/ bằng Bruno.`);
