// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
import { createHooks } from "@nmvuong92/fluxe/react";
import type { contract } from "@backend/contract";
export const api = createHooks<typeof contract>();   // api.<op>.useQuery/useForm/useMutation/useSubscription
