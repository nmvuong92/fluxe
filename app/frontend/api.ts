// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* Client API bind vào contract MỘT lần (như tRPC). contract import TYPE-ONLY → 0 Zod xuống browser.
 * View import từ đây: api.<op>.useQuery/useForm/useMutation/useSubscription (typed). */
import { createHooks } from "@nmvuong92/fluxe/react";
import type { contract } from "@backend/contract";

export const api = createHooks<typeof contract>();
