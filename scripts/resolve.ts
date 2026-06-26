import { writeFileSync, mkdirSync } from "node:fs";
import { resolve as resolveManifest, type CellDecl } from "../src/core/resolver";
import { profiles } from "../app/profiles";
import home from "../app/cells/home/index";
import todos from "../app/cells/todos/index";
import hello from "../app/cells/hello/index";

const name = process.argv[2] ?? process.env.FLUXE_PROFILE ?? "dev";
const profile = profiles[name];
if (!profile) {
  console.error(`Profile không tồn tại: ${name}. Có: ${Object.keys(profiles).join(", ")}`);
  process.exit(1);
}

const cells: CellDecl[] = [home, todos, hello].map((c) => ({
  id: c.id,
  route: c.route,
  hydration: c.hydration,
}));

const manifest = resolveManifest(cells, profile);
mkdirSync(".fluxe", { recursive: true });
writeFileSync(".fluxe/resolution.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(`[resolve] profile="${name}" → .fluxe/resolution.json`);
console.log(JSON.stringify(manifest, null, 2));
