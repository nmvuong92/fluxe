// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Driver S3 — ADAPTER THAM CHIẾU (production). Cùng interface Storage, cùng pattern local.
 * ⚠️ Cần: `npm i @aws-sdk/client-s3` + cấu hình credential. KHÔNG import bởi code đang chạy
 * (chưa cài sdk) → bật khi cần: cài sdk, bỏ comment import, wire vào profile/server.
 *
 * import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
 */
import type { Storage } from "./types.ts";
import { safeKey } from "./types.ts";

export function createS3Storage(opts: {
  bucket: string;
  region: string;
  publicBaseUrl?: string; // vd https://cdn.example.com hoặc https://<bucket>.s3.<region>.amazonaws.com
  // client?: S3Client;   // tự truyền client đã cấu hình credential
}): Storage {
  const base = opts.publicBaseUrl ?? `https://${opts.bucket}.s3.${opts.region}.amazonaws.com`;
  const u = (key: string) => `${base}/${safeKey(key)}`;

  // Khi đã `npm i @aws-sdk/client-s3`, thay phần ném lỗi bằng lệnh thật (mẫu trong comment).
  const notReady = () => {
    throw new Error("createS3Storage: cài '@aws-sdk/client-s3' rồi bỏ comment phần triển khai trong src/storage/s3.ts");
  };

  return {
    name: "s3",
    async put(key, _data, _o) {
      notReady();
      // await client.send(new PutObjectCommand({ Bucket: opts.bucket, Key: safeKey(key), Body: _data, ContentType: _o?.contentType }));
      return { key: safeKey(key), url: u(key), size: _data.length };
    },
    async get(_key) {
      notReady();
      // const r = await client.send(new GetObjectCommand({ Bucket: opts.bucket, Key: safeKey(_key) }));
      // return { data: Buffer.from(await r.Body!.transformToByteArray()), contentType: r.ContentType, size: r.ContentLength ?? 0 };
      return null;
    },
    async delete(_key) {
      notReady();
      // await client.send(new DeleteObjectCommand({ Bucket: opts.bucket, Key: safeKey(_key) }));
    },
    url: u,
  };
}
