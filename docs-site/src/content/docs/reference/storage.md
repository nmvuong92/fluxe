---
title: File storage (upload)
description: Upload file + lưu trữ đa-driver (local, S3, memory), switch bằng config như Backend.
sidebar:
  order: 27
---

## Định nghĩa

Lưu file theo interface **`Storage`** (giống `Backend`): code chỉ biết interface, đổi nơi lưu
(local ↔ S3 ↔ …) = thay driver qua config. Upload + lưu là **I/O-bound** → xử lý ở TS/Node.

## Chọn driver + truyền vào server

```ts
import { makeServer, createLocalStorage, createMemoryStorage, createS3Storage } from "@nmvuong92/fluxe";

const storage = createLocalStorage({ dir: ".fluxe/uploads", baseUrl: "/__file" });
// dev/test: createMemoryStorage()
// prod:     createS3Storage({ bucket, region })   // cần @aws-sdk/client-s3

makeServer(manifest, cells, layouts, { storage }).listen(5180);
```

## Upload từ client

```tsx
import { upload } from "@nmvuong92/fluxe/client";

async function onPick(e) {
  const { key, url, size } = await upload("file", e.target.files[0]);   // POST /__upload/file + CSRF tự kèm
  // dùng url để hiển thị / lưu vào DB
}
<input type="file" onChange={onPick} />
```

Trả `{ key, url, size }` (hoặc mảng nếu nhiều file). Engine: parse multipart → kiểm CSRF + giới
hạn size (mặc định 10MB, đổi qua `{ maxUpload }`) → `storage.put` (key = `<random>-<tên-an-toàn>`).

## Serve file

`GET /__file/<key>` → engine `storage.get(key)` → stream về với đúng content-type. URL này nằm
trong `PutResult.url`.

## Viết driver mới (mở rộng rộng rãi)

Implement `Storage` là dùng được ngay (gcs / azure / r2 / …):

```ts
import type { Storage } from "@nmvuong92/fluxe";

export function createMyStorage(): Storage {
  return {
    name: "mystore",
    async put(key, data, opts) { /* … */ return { key, url: `/__file/${key}`, size: data.length }; },
    async get(key) { /* … */ return null; },
    async delete(key) { /* … */ },
    url(key) { return `/__file/${key}`; },
  };
}
```

## API

```ts
interface Storage {
  name: string;
  put(key, data: Buffer, opts?: { contentType? }): Promise<{ key; url; size }>;
  get(key): Promise<{ data: Buffer; contentType?; size } | null>;
  delete(key): Promise<void>;
  url(key): string;
}
createMemoryStorage(baseUrl?)        // in-RAM (dev/test)
createLocalStorage({ dir, baseUrl? })// đĩa local
createS3Storage({ bucket, region })  // tham chiếu (cần @aws-sdk/client-s3)
safeKey(name)  makeKey(filename, randomHex)   // làm sạch / sinh key
```

## Lưu ý

- **Bảo mật:** upload đi qua CSRF; key được `safeKey` làm sạch (không slash, không `..`) → không
  thoát thư mục. Giới hạn size mặc định 10MB.
- **Native chỉ khi đo được:** resize/thumbnail/transcode/hash lớn (CPU-bound) → adapter media
  riêng (vd Rust napi) — opt-in sau khi profiler chỉ ra. Plain upload+store thì TS là đủ.
- Chưa có (roadmap): presigned URL upload thẳng S3, streaming-to-disk file khổng lồ, media-processing.
