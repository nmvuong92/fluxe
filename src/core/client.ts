/* ============================================================
 * Client runtime — Inertia-style.
 * - navigate(url): fetch JSON props, swap component, không reload.
 * - rpc(cell, action, input): gọi action server type-safe.
 * ============================================================ */

export async function rpc<T = any>(cell: string, action: string, input: unknown): Promise<T> {
  const res = await fetch(`/__action/${cell}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`action ${cell}.${action} lỗi: ${res.status}`);
  return res.json();
}

/* SPA navigation kiểu Inertia: lấy props JSON rồi để runtime render lại */
export async function fetchPageProps(url: string): Promise<{ cell: string; data: unknown }> {
  const res = await fetch(url, { headers: { "x-fluxe": "1" } }); // header báo server trả JSON
  return res.json();
}
