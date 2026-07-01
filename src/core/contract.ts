// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract builder — khai báo nghiệp vụ cell↔backend bằng Zod (type-safe TỨC THÌ, 0 codegen).
 * `f` = lớp sugar mỏng trên Zod: f.string/object/query/mutation/contract. Composition dùng method
 * Zod (.array()/.optional()/.nullable()). Types qua Infer<>; client = Proxy; server đọc contract lúc
 * chạy. DB ẩn sau resolver. tRPC-style: không file sinh ra, không schema xuống browser. */
import { z, type ZodTypeAny, type ZodRawShape, type ZodObject } from "zod";
import type { StandardSchemaV1, InferOutput } from "./standard.ts";

type QueryOpts = { auth?: OpAuth; rest?: RestMeta };
type ShapeToSchema<I> = I extends ZodRawShape ? ZodObject<I> : I;
/* query có 2 dạng: không input (đọc thuần) hoặc có input (vd GET /todos/:id). Overload để suy đúng. */
interface QueryFn {
  <O extends ZodTypeAny>(output: O, opts?: QueryOpts): { kind: "query"; output: O } & QueryOpts;
  <O extends ZodTypeAny, I extends ZodRawShape | ZodTypeAny>(output: O, opts: QueryOpts & { input: I }): { kind: "query"; output: O; input: ShapeToSchema<I> } & QueryOpts;
}
const queryFn: QueryFn = ((output: any, opts?: any) => {
  const { input, ...rest } = opts ?? {};
  const inputSchema = input ? (input instanceof z.ZodType ? input : z.object(input as ZodRawShape)) : undefined;
  return { kind: "query", output, ...(inputSchema ? { input: inputSchema } : {}), ...rest };
}) as QueryFn;

/* auth: true = cần đăng nhập; string = cần role đó (kiểm trên ctx.session host gắn). */
export type OpAuth = true | string;
/* rest: expose op ra REST endpoint (ngoài /__rpc). path có :param → vào input; v1/v2 = đặt trong path. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface RestMeta { method: HttpMethod; path: string }
/* input/output = StandardSchemaV1 → nhận BẤT KỲ validator nào (Zod/Valibot/TypeBox…). `f` dưới
 * đây là sugar Zod mặc định (Zod ≥3.24 thoả interface). query có thể có `input` (vd GET /todos/:id). */
export type OpDef =
  | { kind: "query"; output: StandardSchemaV1; input?: StandardSchemaV1; auth?: OpAuth; rest?: RestMeta }
  | { kind: "mutation"; input: StandardSchemaV1; output: StandardSchemaV1; auth?: OpAuth; rest?: RestMeta }
  | { kind: "subscription"; output: StandardSchemaV1; auth?: OpAuth };
export type Contract = Record<string, OpDef>;

export const f = {
  string: z.string(),
  int: z.number().int(),
  number: z.number(),
  bool: z.boolean(),
  null: z.null(),
  object: <T extends ZodRawShape>(shape: T) => z.object(shape),
  union: <T extends readonly [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]>(...opts: T) => z.union(opts as any),
  /* coerce: form-friendly — input HTML là string, ép về number/int/bool (vd startPrice từ <input number>). */
  coerce: { number: () => z.coerce.number(), int: () => z.coerce.number().int(), bool: () => z.coerce.boolean() },
  query: queryFn,
  mutation: <I extends ZodRawShape | ZodTypeAny, O extends ZodTypeAny>(input: I, output: O, opts?: { auth?: OpAuth; rest?: RestMeta }) =>
    ({ kind: "mutation", input: (input instanceof z.ZodType ? input : z.object(input as ZodRawShape)) as ZodTypeAny, output, ...opts } as const),
  /* subscription: stream typed qua broker SSE (topic = op name). Mutation publish vào topic này
   * (ctx.publish) → mọi subscriber nhận. Client: api.<op>.useSubscription(cb). */
  subscription: <O extends ZodTypeAny>(output: O, opts?: { auth?: OpAuth }) => ({ kind: "subscription", output, ...opts } as const),
  contract: <C extends Contract>(ops: C) => ops,
};

/* Suy kiểu TS từ schema — tức thì, không chờ gen. (`infer` là từ khoá TS → dùng `Infer`.)
 * Nhận Zod HOẶC bất kỳ StandardSchema; với Zod = y hệt `z.infer`. */
export type Infer<T extends ZodTypeAny | StandardSchemaV1> = T extends ZodTypeAny ? z.infer<T> : T extends StandardSchemaV1 ? InferOutput<T> : never;

/* Context tiêm vào resolver (arg 2) — session (host gắn, typed) + publish (realtime) + span (trace).
 *   ctx.session?.id        → ai đang gọi (sellerId/bidderId…), host-verified
 *   ctx.span("db.query", () => db.find(...))  → span con dưới resolver trong waterfall DevTools. */
export interface ResolverCtx<S = unknown> {
  session: S | null;        // do HOST gắn (req.session); null nếu chưa đăng nhập
  publish: (topic: string, data: unknown) => void;
  span: <T>(name: string, fn: () => T | Promise<T>) => Promise<T>;
}

/* Op KHÔNG phải subscription (query/mutation) — subscription không có resolver req/res, là topic. */
type DataOp<C extends Contract> = { [K in keyof C as C[K] extends { kind: "subscription" } ? never : K]: C[K] };

type OpFn<D> = D extends { input: infer I extends StandardSchemaV1; output: infer O extends StandardSchemaV1 }
  ? (input: InferOutput<I>) => Promise<InferOutput<O>>
  : D extends { output: infer O extends StandardSchemaV1 } ? () => Promise<InferOutput<O>>
  : never;

/* Resolver server: op có input → (input, ctx); query không input → (ctx?). ctx = { session, publish, span }. */
type ResolverFn<D, S> = D extends { input: infer I extends StandardSchemaV1; output: infer O extends StandardSchemaV1 }
  ? (input: InferOutput<I>, ctx: ResolverCtx<S>) => InferOutput<O> | Promise<InferOutput<O>>
  : D extends { kind: "query"; output: infer O extends StandardSchemaV1 } ? (ctx?: ResolverCtx<S>) => InferOutput<O> | Promise<InferOutput<O>>
  : never;

/* Kiểu resolver backend phải implement — suy từ contract (compile-fail nếu sai chữ ký). Bỏ subscription.
 * S = kiểu session (createCells<B,S> dùng cùng kiểu) → ctx.session typed trong resolver. */
export type Resolvers<C extends Contract, S = unknown> = { [K in keyof DataOp<C>]: ResolverFn<DataOp<C>[K], S> };
/* Kiểu client api (query/mutation, gọi qua /__rpc) — subscription đi qua useSubscription. */
export type Client<C extends Contract> = { [K in keyof DataOp<C>]: OpFn<DataOp<C>[K]> };
