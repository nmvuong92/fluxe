# Thiết kế: File Storage (upload + driver)

> Mục tiêu: upload file + lưu trữ đa-driver (local, S3, …), mở rộng rộng rãi, theo RCA.
> Phân tích tầng: **TS/Node** xử lý upload+store (I/O-bound); native chỉ cho media-processing đo được.

## 1. Vì sao TS (không Go/Rust)
- Nhận multipart + ghi đĩa/PUT S3 + serve = **I/O-bound** → Node event loop là đúng tầng.
- Go/Rust chỉ đáng khi **CPU-bound song-song-hoá-được** (resize/transcode/hash lớn) — adapter
  media riêng, opt-in, sau khi profiler chỉ ra (đúng bài học napi-rs đã đo).

## 2. `Storage` interface (như `Backend` — resolve qua config)
```ts
export interface PutResult { key: string; url: string; size: number }
export interface GetResult { data: Buffer; contentType?: string; size: number }
export interface Storage {
  name: string;
  put(key: string, data: Buffer, opts?: { contentType?: string }): Promise<PutResult>;
  get(key: string): Promise<GetResult | null>;
  delete(key: string): Promise<void>;
  url(key: string): string;            // URL serve công khai
}
```

## 3. Driver
- `createMemoryStorage()` — Map in-RAM (dev/test). THUẦN, dễ test.
- `createLocalStorage({ dir, baseUrl="/__file" })` — ghi đĩa dưới `dir`, serve qua `/__file/<key>`.
- `createS3Storage({ bucket, region, … })` — adapter tham chiếu (lazy `@aws-sdk/client-s3`),
  giống `createPostgresBackend`: không import lúc chạy nếu chưa cần.
- **Mở rộng:** implement `Storage` là xong (gcs/azure/r2…). Engine + cell không đổi.

## 4. Multipart parser (THUẦN, testable)
`parseMultipart(body: Buffer, boundary: string): Part[]` — `Part { name, filename?, contentType?, data: Buffer }`.
Không phụ thuộc lib (chỉ node Buffer). Test các case: 1 file, nhiều field, field text, filename rỗng.

## 5. Engine (server_factory)
- `POST /__upload/<field>` (DEV/cấu hình): CSRF → đọc body → `parseMultipart` → kiểm size/type →
  `storage.put(key, data)` → trả `{ key, url, size }`. Key = `<random>-<filename>` (sanitize).
- `GET /__file/<key>` → `storage.get(key)` → stream về (cho driver local/memory). Content-Type đúng.
- Storage tiêm qua DI: `makeServer(manifest, cells, layouts, { i18n, storage })`.
- Giới hạn: `maxBytes` (mặc định ~10MB), allowlist content-type (tuỳ chọn).

## 6. Client
- `upload(field, file): Promise<PutResult>` — POST FormData tới `/__upload/<field>` (kèm CSRF).
- Hook `useUpload()` (tuỳ chọn, v1 đủ với `upload()`).

## 7. Lộ trình
1. `multipart.ts` (parser) + test. ← TDD trước
2. `storage/{types,memory,local}.ts` + test memory.
3. Endpoint `/__upload` + `/__file` trong engine + DI.
4. Client `upload()`.
5. `createS3Storage` (tham chiếu, lazy).
6. Docs reference/storage + features. Release 0.3.0.

## 8. Phi mục tiêu (v1)
- Chưa resize/thumbnail/transcode (media-processing = bước Rust opt-in sau).
- Chưa multipart streaming-to-disk khổng lồ (v1 đọc vào Buffer, giới hạn maxBytes); streaming lớn = v2.
- Chưa signed URL / presigned upload trực tiếp S3 (v2).
