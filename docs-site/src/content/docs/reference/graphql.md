---
title: GraphQL
description: Sinh GraphQL schema + /graphql (graphql-yoga, no lock-in) từ contract — dùng chung resolver.
sidebar:
  order: 13
---

`@nmvuong92/fluxe/graphql` biến **contract** thành GraphQL schema + endpoint `/graphql` (GraphiQL sẵn)
— **dùng chung contract + resolver** với RPC/REST. **1 khai báo → RPC + REST + GraphQL + OpenAPI + Bruno**,
0 codegen. Default **graphql-yoga** (The Guild): nhẹ, spec-compliant, không khóa Apollo.

## Dùng

```bash
npm i graphql graphql-yoga   # peerDependency optional (chỉ khi dùng GraphQL)
```

```ts
import { graphqlHandler } from "@nmvuong92/fluxe/graphql";
import { contract } from "@backend/contract";

// Express: mount 1 dòng (host sở hữu route)
server.use(graphqlHandler(contract, app.resolvers));   // GET /graphql = GraphiQL · POST = query/mutation
```

```ts
// Fastify:
const gql = graphqlHandler(contract, app.resolvers);
server.route({ method: ["GET", "POST"], url: "/graphql",
  handler: (req, reply) => { reply.hijack(); gql(req.raw, reply.raw, () => reply.raw.end()); } });
```

`fx init <name> --api` sinh sẵn cả 3 (RPC + REST + GraphQL) + OpenAPI/Bruno.

## Ánh xạ

| Contract | GraphQL |
|----------|---------|
| `f.query` | field `Query.<op>` (args từ input nếu có) |
| `f.mutation` | field `Mutation.<op>(args)` |
| `f.subscription` | **bỏ** (SSE `/__sse`; GraphQL subscription = follow-up) |
| Zod object/array/scalar | GraphQLObjectType / List / scalar (NonNull nếu required) |

## Chỉ `schema` (tự mount tuỳ ý)

```ts
import { toGraphQLSchema } from "@nmvuong92/fluxe/graphql";
const schema = toGraphQLSchema(contract, resolvers);   // GraphQLSchema (graphql-js) — dùng với Apollo/mesh… nếu thích
```

Resolver **giống hệt** RPC/REST: `(input, ctx) => …` với `ctx.session/publish/span`. Không viết resolver riêng cho GraphQL.
