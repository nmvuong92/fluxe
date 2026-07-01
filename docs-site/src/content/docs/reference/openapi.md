---
title: OpenAPI & Bruno
description: Sinh OpenAPI 3.1 + collection Bruno từ contract — thuần TS, 0 dep, 0 codegen.
sidebar:
  order: 12
---

`@nmvuong92/fluxe/openapi` biến **contract** thành tài liệu API + client **client ngoài** (mobile,
curl, service khác) dùng được — thuần TS, 0 dep, 0 codegen. Điểm khác biệt: **export Bruno**
(collection `.bru` git-friendly, offline) mà Nest/Hono/tRPC không tự làm.

## Dùng

```ts
import { toOpenApi, toBruno } from "@nmvuong92/fluxe/openapi";
import { contract } from "@backend/contract";

const doc = toOpenApi(contract, { title: "Todo API", version: "1.0.0" });
// → OpenAPI 3.1: query/mutation = POST /__rpc/<op> (mutation có requestBody); subscription (SSE) bỏ.

const files = toBruno(contract, { name: "Todo API", baseUrl: "http://localhost:5180" });
// → { "bruno.json", "environments/local.bru", "<op>.bru"… } — ghi ra đĩa = mở bằng Bruno chạy ngay.
```

## Serve `/openapi.json` + `/docs` (Swagger UI)

`openApiHandler` là **node middleware** — mount TRƯỚC fluxe (host sở hữu route):

```ts
import { openApiHandler } from "@nmvuong92/fluxe/openapi";
import { contract } from "@backend/contract";

server.use(openApiHandler(contract, { title: "Todo API" }));   // Express
// → GET /openapi.json (spec) · GET /docs (Swagger UI qua CDN)
```

## CLI — `fx openapi`

```bash
fx openapi "Todo API"      # ghi .fluxe/openapi.json + bruno/ (collection Bruno)
```

Mở thư mục `bruno/` bằng [Bruno](https://usebruno.com) → có sẵn request mỗi op, chạy ngay. `baseUrl`
đổi qua `FLUXE_OPENAPI_BASEURL`.

## Ánh xạ

| Contract | HTTP | OpenAPI / Bruno |
|----------|------|-----------------|
| `f.query` | `POST /__rpc/<op>` | body:none, response = output schema |
| `f.mutation` | `POST /__rpc/<op>` | requestBody = input schema, response = output |
| `f.subscription` | `/__sse/<op>` (SSE) | **bỏ** khỏi paths HTTP |

## Schema

`schemaToJson` introspect surface của `f` (Zod) → JSON Schema. Validator khác qua **Standard Schema**
(Valibot/TypeBox…) → schema permissive `{}` (vẫn dùng được, kém chi tiết). Muốn chính xác hơn với
validator khác: truyền JSON Schema của họ.

## API

```ts
toOpenApi(contract, { title?, version?, prefix? }): OpenAPI31
toBruno(contract, { name?, baseUrl?, prefix? }): Record<filename, content>
schemaToJson(schema): JsonSchema
```
