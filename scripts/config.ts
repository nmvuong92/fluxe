// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx config — in config đã giải (default ← ENV FLUXE_* ← override). Như `artisan config:show`. */
import { loadConfig, ENV_KEYS } from "../src/core/config.ts";

const cfg = loadConfig();
console.log("[config] đã giải (default ← ENV FLUXE_* ← override):\n");
console.log(JSON.stringify(cfg, null, 2));
console.log("\n[env keys] biến ENV → field:");
for (const [env, field] of Object.entries(ENV_KEYS)) console.log(`  ${env.padEnd(28)} → ${field}`);
