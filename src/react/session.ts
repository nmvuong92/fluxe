// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* useSession() — đọc session host gắn (qua /__session) ở client. Typed qua generic S.
 * Auth thật (login/OAuth) do provider lo; hook chỉ đọc trạng thái + signOut. */
import { useState, useEffect, useCallback } from "react";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface UseSession<S> {
  data: S | null;
  status: SessionStatus;
  refetch: () => void;
  signOut: (url?: string) => Promise<void>;
}

export function useSession<S = any>(opts?: { signOutUrl?: string }): UseSession<S> {
  const [data, setData] = useState<S | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const refetch = useCallback(() => {
    fetch("/__session")
      .then((r) => r.json())
      .then((s) => { setData(s ?? null); setStatus(s ? "authenticated" : "unauthenticated"); })
      .catch(() => { setData(null); setStatus("unauthenticated"); });
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  const signOut = useCallback(async (url = opts?.signOutUrl ?? "/api/auth/sign-out") => {
    await fetch(url, { method: "POST" }).catch(() => {});
    refetch();
  }, [refetch, opts?.signOutUrl]);

  return { data, status, refetch, signOut };
}
