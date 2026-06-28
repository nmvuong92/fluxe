// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract builder — khai báo nghiệp vụ cell↔backend bằng Zod (type-safe TỨC THÌ, 0 codegen).
 * `f` = lớp sugar mỏng trên Zod: f.string/object/query/mutation/contract. Composition dùng method
 * Zod (.array()/.optional()/.nullable()). Types qua Infer<>; client = Proxy; server đọc contract lúc
 * chạy. DB ẩn sau resolver. tRPC-style: không file sinh ra, không schema xuống browser. */
import { z, type ZodTypeAny, type ZodRawShape } from "zod";

/* auth: true = cần đăng nhập; string = cần role đó (kiểm trên ctx.session host gắn). */
export type OpAuth = true | string;
export type OpDef =
  | { kind: "query"; output: ZodTypeAny; auth?: OpAuth }
  | { kind: "mutation"; input: ZodTypeAny; output: ZodTypeAny; auth?: OpAuth }
  | { kind: "subscription"; output: ZodTypeAny; auth?: OpAuth };
export type Contract = Record<string, OpDef>;

export const f = {
  string: z.string(),
  int: z.number().int(),
  number: z.number(),
  bool: z.boolean(),
  null: z.null(),
  object: <T extends ZodRawShape>(shape: T) => z.object(shape),
  union: <T extends readonly [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>(...opts: T) => z.union(opts as any),
  query: <O extends ZodTypeAny>(output: O, opts?: { auth?: OpAuth }) => ({ kind: "query", output, ...opts } as const),
  mutation: <I extends ZodRawShape | ZodTypeAny, O extends ZodTypeAny>(input: I, output: O, opts?: { auth?: OpAuth }) =>
    ({ kind: "mutation", input: (input instanceof z.ZodType ? input : z.object(input as ZodRawShape)) as ZodTypeAny, output, ...opts } as const),
  /* subscription: stream typed qua broker SSE (topic = op name). Mutation publish vào topic này
   * (ctx.publish) → mọi subscriber nhận. Client: api.<op>.useSubscription(cb). */
  subscription: <O extends ZodTypeAny>(output: O, opts?: { auth?: OpAuth }) => ({ kind: "subscription", output, ...opts } as const),
  contract: <C extends Contract>(ops: C) => ops,
};

/* Suy kiểu TS từ schema Zod — tức thì, không chờ gen. (`infer` là từ khoá TS → dùng `Infer`.) */
export type Infer<T extends ZodTypeAny> = z.infer<T>;

/* Context tiêm vào resolver (arg 2) — publish vào topic subscription để realtime. */
export interface ResolverCtx { publish: (topic: string, data: unknown) => void }

/* Op KHÔNG phải subscription (query/mutation) — subscription không có resolver req/res, là topic. */
type DataOp<C extends Contract> = { [K in keyof C as C[K] extends { kind: "subscription" } ? never : K]: C[K] };

type OpFn<D> = D extends { input: infer I extends ZodTypeAny; output: infer O extends ZodTypeAny }
  ? (input: z.infer<I>) => Promise<z.infer<O>>
  : D extends { output: infer O extends ZodTypeAny } ? () => Promise<z.infer<O>>
  : never;

/* Resolver server: mutation nhận (input, ctx); query nhận (ctx?). ctx.publish → realtime. */
type ResolverFn<D> = D extends { kind: "mutation"; input: infer I extends ZodTypeAny; output: infer O extends ZodTypeAny }
  ? (input: z.infer<I>, ctx: ResolverCtx) => z.infer<O> | Promise<z.infer<O>>
  : D extends { kind: "query"; output: infer O extends ZodTypeAny } ? (ctx?: ResolverCtx) => z.infer<O> | Promise<z.infer<O>>
  : never;

/* Kiểu resolver backend phải implement — suy từ contract (compile-fail nếu sai chữ ký). Bỏ subscription. */
export type Resolvers<C extends Contract> = { [K in keyof DataOp<C>]: ResolverFn<DataOp<C>[K]> };
/* Kiểu client api (query/mutation, gọi qua /__rpc) — subscription đi qua useSubscription. */
export type Client<C extends Contract> = { [K in keyof DataOp<C>]: OpFn<DataOp<C>[K]> };
