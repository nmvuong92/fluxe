// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Contract → GraphQLSchema (graphql-js, no lock-in). query/mutation = field Query/Mutation; Zod →
 * GraphQL type; resolver DÙNG CHUNG với RPC/REST. subscription (SSE) bỏ khỏi schema HTTP. 0 codegen. */
import {
  GraphQLSchema, GraphQLObjectType, GraphQLInputObjectType, GraphQLString, GraphQLInt, GraphQLFloat,
  GraphQLBoolean, GraphQLList, GraphQLNonNull, type GraphQLType, type GraphQLFieldConfigArgumentMap,
} from "graphql";
import type { Contract } from "../core/contract.ts";

const def = (s: any) => s?._def;
const tn = (s: any) => def(s)?.typeName as string | undefined;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isOptional = (s: any) => ["ZodOptional", "ZodNullable", "ZodDefault"].includes(tn(s) ?? "");
function unwrap(s: any): any { return isOptional(s) ? unwrap(def(s).innerType) : s; }
const shapeOf = (s: any) => (s.shape ?? def(s).shape?.()) as Record<string, any>;

type Cache = Map<any, GraphQLType>;

/* Type có nullability: optional/nullable → nullable; còn lại → NonNull. */
function gqlType(schema: any, role: "output" | "input", name: string, cache: Cache): GraphQLType {
  const base = gqlBase(unwrap(schema), role, name, cache);
  return isOptional(schema) ? base : new GraphQLNonNull(base);
}
function gqlBase(s: any, role: "output" | "input", name: string, cache: Cache): GraphQLType {
  switch (tn(s)) {
    case "ZodString": return GraphQLString;
    case "ZodNumber": return (def(s).checks ?? []).some((c: any) => c.kind === "int") ? GraphQLInt : GraphQLFloat;
    case "ZodBoolean": return GraphQLBoolean;
    case "ZodArray": return new GraphQLList(gqlType(def(s).type, role, name, cache));
    case "ZodObject": {
      if (cache.has(s)) return cache.get(s)!;
      const fields: Record<string, any> = {};
      const t = role === "input"
        ? new GraphQLInputObjectType({ name: name + "Input", fields: () => fields })
        : new GraphQLObjectType({ name, fields: () => fields });
      cache.set(s, t);
      for (const [k, v] of Object.entries(shapeOf(s))) fields[k] = { type: gqlType(v, role, name + cap(k), cache) };
      return t;
    }
    default: return GraphQLString;   // kiểu chưa map → String (permissive)
  }
}

function argsFrom(input: any, name: string, cache: Cache): GraphQLFieldConfigArgumentMap {
  const args: GraphQLFieldConfigArgumentMap = {};
  for (const [k, v] of Object.entries(shapeOf(unwrap(input)))) args[k] = { type: gqlType(v, "input", name + cap(k), cache) as any };
  return args;
}

export interface GraphQLOpts { queryName?: string; mutationName?: string }

export function toGraphQLSchema(contract: Contract, resolvers: any, _opts: GraphQLOpts = {}): GraphQLSchema {
  const cache: Cache = new Map();
  const queryFields: Record<string, any> = {};
  const mutationFields: Record<string, any> = {};
  for (const [op, d] of Object.entries(contract)) {
    if (d.kind === "subscription") continue;
    const input = (d as any).input;
    const field: any = {
      type: gqlType(d.output, "output", cap(op) + "Result", cache),
      resolve: (_parent: any, args: any, ctx: any) => {
        const fn = resolvers?.[op];
        if (typeof fn !== "function") throw new Error(`[graphql] resolver thiếu cho '${op}'`);
        const fluxeCtx = { session: ctx?.session ?? null, publish: ctx?.publish ?? (() => {}), span: <T>(_n: string, f: () => T) => f() };
        return input ? fn(args, fluxeCtx) : fn(fluxeCtx);
      },
    };
    if (input) field.args = argsFrom(input, cap(op), cache);
    (d.kind === "query" ? queryFields : mutationFields)[op] = field;
  }
  const query = new GraphQLObjectType({ name: _opts.queryName ?? "Query", fields: queryFields });
  const mutation = Object.keys(mutationFields).length
    ? new GraphQLObjectType({ name: _opts.mutationName ?? "Mutation", fields: mutationFields })
    : undefined;
  return new GraphQLSchema({ query, mutation });
}
