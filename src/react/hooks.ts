// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* createHooks<typeof contract>() — bind hook React vào contract MỘT lần (như createClient).
 * Mỗi op → object hook hợp kind: query→useQuery, mutation→useMutation+useForm. Typed tức thì
 * qua infer; op name (string) đủ gọi /__rpc → KHÔNG cần schema runtime ở client (0 zod xuống
 * browser). Hooks string-based cũ giữ nguyên — đây là lớp THÊM typed. */
import { useEffect, useRef } from "react";
import type { ZodTypeAny } from "zod";
import type { Contract, Client, Infer } from "../core/contract.ts";
import { createClient, mutate as coreMutate, subscribe } from "../core/client.ts";
import { useQuery, invalidateQueries } from "./query.ts";
import { useMutation as useRawMutation } from "./mutation.ts";
import { useForm, type FormOpts, type FormApi } from "./form.ts";

/* useSubscription — nghe topic (op subscription) qua broker SSE, typed. Bỏ frame presence
 * (broker dùng chung topic cho presence). cb mới nhất giữ qua ref (không re-subscribe). */
export function useSubscription<T>(op: string, cb: (data: T) => void): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => subscribe(op, (data: any) => {
    if (data && typeof data === "object" && "presence" in data) return;   // bỏ presence
    ref.current(data as T);
  }), [op]);
}

export interface QueryResult<O> { data: O | undefined; error: string; loading: boolean; refetch: () => Promise<void> }
export interface QueryOpts<O> { initial?: O; enabled?: boolean }

export interface MutationOpts<C extends Contract, I> {
  invalidates?: (keyof C & string)[];
  optimistic?: (input: I) => (() => void) | void;   // trả rollback (gọi khi lỗi)
  onSuccess?: (out: unknown) => void;
}
export interface MutationResult<I, O> { mutate: (input: I) => Promise<O | undefined>; loading: boolean; error: string }

/* useMutation contract-aware: optimistic+rollback (core mutate), invalidate query op sau success. */
function useContractMutation<C extends Contract, I, O>(op: string, fn: (input: I) => Promise<O>, opts: MutationOpts<C, I> = {}): MutationResult<I, O> {
  const base = useRawMutation<I, O>(op, fn);
  async function mutate(input: I): Promise<O | undefined> {
    const rollback = opts.optimistic ? opts.optimistic(input) || undefined : undefined;
    try {
      const out = await coreMutate({ run: () => base.mutate(input) as Promise<O> });
      if (opts.invalidates) invalidateQueries(opts.invalidates as string[]);
      opts.onSuccess?.(out);
      return out;
    } catch (e) {
      rollback?.();
      throw e;
    }
  }
  return { mutate, loading: base.loading, error: base.error };
}

/* Bề mặt hook cho 1 op — suy theo kind. */
type OpHooks<D, C extends Contract> =
  D extends { kind: "query"; output: infer O extends ZodTypeAny }
    ? { useQuery: (opts?: QueryOpts<Infer<O>>) => QueryResult<Infer<O>> }
  : D extends { kind: "mutation"; input: infer I extends ZodTypeAny; output: infer O extends ZodTypeAny }
    ? {
        useMutation: (opts?: MutationOpts<C, Infer<I>>) => MutationResult<Infer<I>, Infer<O>>;
        useForm: (opts?: FormOpts<Infer<I>, Infer<O>>) => FormApi<Infer<I>, Infer<O>>;
      }
  : D extends { kind: "subscription"; output: infer O extends ZodTypeAny }
    ? { useSubscription: (cb: (data: Infer<O>) => void) => void }
  : Record<string, never>;

export type Hooks<C extends Contract> = { [K in keyof C]: OpHooks<C[K], C> };

export function createHooks<C extends Contract>(client?: Client<C>): Hooks<C> {
  const api = (client ?? createClient<C>()) as Record<string, (input?: unknown) => Promise<unknown>>;
  const memo: Record<string, unknown> = {};
  return new Proxy({}, {
    get(_t, op: string) {
      if (!(op in memo)) {
        memo[op] = {
          useQuery: (opts?: QueryOpts<unknown>) => useQuery(op, () => api[op](), opts),
          useMutation: (opts?: MutationOpts<C, unknown>) => useContractMutation(op, (i: unknown) => api[op](i), opts),
          useForm: (opts?: FormOpts<any, any>) => useForm(op, (i: any) => api[op](i) as Promise<any>, opts),
          useSubscription: (cb: (data: unknown) => void) => useSubscription(op, cb),
        };
      }
      return memo[op];
    },
  }) as Hooks<C>;
}

// re-export để app dùng 1 chỗ
export { useForm } from "./form.ts";
export type { FormOpts, FormApi } from "./form.ts";
