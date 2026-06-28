// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* @fluxe/react — debug store + tracing (lite). Mọi query/mutation/error ghi vào đây;
 * DebugBar subscribe để hiển thị "full flow". Immutable update → useSyncExternalStore re-render. */

export type EventKind = "query" | "mutation" | "subscription" | "error";
export type EventStatus = "pending" | "ok" | "error";

export interface DebugEvent {
  id: number;
  kind: EventKind;
  label: string;
  status: EventStatus;
  startedAt: number;
  ms?: number;          // client total
  data?: unknown;
  error?: string;
  input?: unknown;      // cho repro→test
  resolution?: string;  // RCA: backend lang/transport đã giải (#3)
  serverMs?: number;    // thời gian server-side (#4 trace)
  trace?: import("../core/trace.ts").Span | null;   // cây span pipeline (waterfall)
}

type Listener = () => void;
const MAX = 50;

export class DebugStore {
  events: DebugEvent[] = [];
  private listeners = new Set<Listener>();
  private seq = 0;

  start(kind: EventKind, label: string): number {
    const id = ++this.seq;
    const ev: DebugEvent = { id, kind, label, status: "pending", startedAt: now() };
    this.events = [ev, ...this.events].slice(0, MAX); // immutable + cap
    this.emit();
    return id;
  }

  finish(id: number, patch: Partial<DebugEvent>): void {
    this.events = this.events.map((e) =>
      e.id === id ? { ...e, ...patch, ms: now() - e.startedAt } : e,
    );
    this.emit();
  }

  clear(): void {
    this.events = [];
    this.emit();
  }

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): DebugEvent[] => this.events; // ref ổn định giữa các lần mutate

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

function now(): number {
  return typeof performance !== "undefined" ? Math.round(performance.now()) : 0;
}

export const debug = new DebugStore(); // singleton dùng chung
