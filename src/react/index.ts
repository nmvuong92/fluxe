// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* @fluxe/react — devtools lite: data fetching + tracing + debug bar.
 * Dùng: useQuery / useMutation trong cell; mount <DebugBar/> 1 lần. */
export { useQuery, invalidateQueries } from "./query";
export { useMutation } from "./mutation";
/* contract-aware: bind hook vào contract một lần (như createClient). */
export { createHooks, useForm } from "./hooks";
export type { Hooks, QueryResult, QueryOpts, MutationOpts, MutationResult } from "./hooks";
export type { FormOpts, FormApi, ClientSchema } from "./form";
export { Link } from "./Link";
export { Nav, type NavItem } from "./Nav";
export { useTheme, type Theme } from "./theme";
export { ThemeToggle } from "./ThemeToggle";
export { LocaleSwitch } from "./LocaleSwitch";
export { shellScript } from "./shell";
export { DebugBar } from "./DebugBar";
export { debug, DebugStore } from "./store";
export type { DebugEvent } from "./store";
export { useSession } from "./session";   // auth integration: đọc session host gắn (typed)
export type { SessionStatus, UseSession } from "./session";
