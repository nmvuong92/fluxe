#!/usr/bin/env -S node --experimental-sqlite --import tsx
// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* fx — fluxe CLI. Chạy: npm run fx -- <lệnh> [args]  (vd: npm run fx -- build prod-go) */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { makeCommands, renderUsage } from "../src/core/cli.ts";

const PKG = join(dirname(fileURLToPath(import.meta.url)), "..");   // engine root (bin/ → ..)
const COMMANDS = makeCommands(PKG);

const [cmd, ...args] = process.argv.slice(2);
const unknown = cmd && cmd !== "help" && !COMMANDS[cmd];

if (!cmd || cmd === "help" || unknown) {
  if (unknown) console.error(`Lệnh không tồn tại: ${cmd}\n`);
  console.log(renderUsage());
  process.exit(unknown ? 1 : 0);
}

const shell = COMMANDS[cmd].shell(args);
console.log(`[fx] ${cmd} → ${shell}`);
execSync(shell, { stdio: "inherit" });
