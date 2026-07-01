// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* @nmvuong92/fluxe/graphql — contract → GraphQL schema + /graphql (graphql-yoga, no lock-in).
 * Dùng chung contract+resolver: 1 khai báo → RPC + REST + GraphQL + OpenAPI + Bruno. */
export { toGraphQLSchema, type GraphQLOpts } from "./schema.ts";
export { graphqlHandler, type GraphQLServeOpts } from "./serve.ts";
