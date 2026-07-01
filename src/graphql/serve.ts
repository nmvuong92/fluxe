// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* graphqlHandler(contract, resolvers) — node middleware serve /graphql (graphql-yoga + GraphiQL).
 * Mount TRƯỚC fluxe (host sở hữu route). Dùng chung contract+resolver → 1 khai báo cho RPC/REST/GraphQL. */
import { createYoga } from "graphql-yoga";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Contract } from "../core/contract.ts";
import { toGraphQLSchema, type GraphQLOpts } from "./schema.ts";

export interface GraphQLServeOpts extends GraphQLOpts { path?: string; graphiql?: boolean }

export function graphqlHandler(contract: Contract, resolvers: any, opts: GraphQLServeOpts = {}) {
  const endpoint = opts.path ?? "/graphql";
  const yoga = createYoga({
    schema: toGraphQLSchema(contract, resolvers, opts),
    graphqlEndpoint: endpoint,
    graphiql: opts.graphiql ?? true,          // GraphiQL UI sẵn ở GET /graphql
    // session host gắn (req.session) → contextValue cho resolver (ctx.session typed).
    context: ({ req }: any) => ({ session: req?.session ?? null, publish: () => {} }),
  });
  return (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if ((req.url ?? "").split("?")[0] !== endpoint) return next();
    return (yoga as any)(req, res);
  };
}
