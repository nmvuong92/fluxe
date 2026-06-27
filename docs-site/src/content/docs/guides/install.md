---
title: Cài đặt
description: Cài @nmvuong92/fluxe từ npm + thiết lập tối thiểu.
sidebar:
  order: 2
---

## Cài package

```bash
npm i @nmvuong92/fluxe react react-dom zod
# devDeps để chạy TS trực tiếp + bundle client:
npm i -D typescript tsx esbuild @types/node @types/react @types/react-dom
```

`react`/`react-dom` là **peerDependencies** (bạn tự cài). `zod` là dependency của engine.

## Các entry import

| Import | Dùng cho |
|--------|----------|
| `@nmvuong92/fluxe` | engine: `defineCell`, `makeServer`, `withInput`, backends, auth, resolver, seo… |
| `@nmvuong92/fluxe/react` | `useQuery`, `useMutation`, `Link`, `Nav`, `ThemeToggle`, `useTheme`, `DebugBar` |
| `@nmvuong92/fluxe/client` | `rpc`, `RpcError`, `mutate`, `revalidate`, `subscribe` |
| `@nmvuong92/fluxe/jobs` | `createQueue`, `drain` (cần `node --experimental-sqlite`) |
| `@nmvuong92/fluxe/sqlite` | `createSqliteBackend` (cần `--experimental-sqlite`) |

## tsconfig tối thiểu

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "jsx": "react-jsx", "strict": true, "esModuleInterop": true,
    "skipLibCheck": true, "noEmit": true, "types": ["node"], "lib": ["ES2022", "DOM"]
  }
}
```

## Cell đầu tiên

```tsx
// cells/home/index.tsx
import { defineCell } from "@nmvuong92/fluxe";

export default defineCell<{}, { title: string }>({
  id: "home",
  route: "/",
  async loader() { return { title: "Xin chào fluxe" }; },   // hydration mặc định "island"
  view: ({ data }) => <h1>{data.title}</h1>,
});
```

## Chạy server

```ts
// server.ts
import { makeServer, resolve } from "@nmvuong92/fluxe";
import home from "./cells/home/index";

const manifest = resolve([home], { name: "dev", backend: "memory" });
makeServer(manifest, [home]).listen(5180, () => console.log("http://localhost:5180"));
```

```bash
npx tsx server.ts
```

:::tip[Dev nhanh tại repo fluxe]
Đang phát triển song song engine + app trong repo fluxe? `tsconfig` đã map
`@nmvuong92/fluxe` → `./src` (paths) nên **local chạy thẳng `src`, 0 build**; khi publish thì
`exports` trỏ `lib/` (đã build). Xem [Tutorial](/guides/tutorial/) cho luồng `fx init`/`fx new`
đầy đủ (layout + theme + nav + auto-discovery).
:::

## Publish phiên bản mới (cho maintainer)

```bash
npm version patch          # bump version
npm publish                # prepublishOnly tự build src → lib; 2FA → nhập OTP
```
