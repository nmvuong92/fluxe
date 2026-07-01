// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
export const env = {
  PORT: Number(process.env.PORT ?? 5180),
  NODE_ENV: process.env.NODE_ENV ?? "development",
};
