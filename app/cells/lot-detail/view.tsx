import { useState } from "react";
import { Link, useSubscription } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
import type { Lot, Bid } from "../../backend/data";

export interface LotDetailData { lot: Lot; bids: Bid[] }

const fmt = (n: number) => "$" + n.toLocaleString();

export function LotDetail({ data }: { data: LotDetailData }) {
  const [lot, setLot] = useState<Lot>(data.lot);
  // Realtime: ai đặt giá → server publish `lot:<id>` (Lot mới) → cập nhật live, typed, 0 refetch.
  useSubscription<Lot>(`lot:${data.lot.id}`, (next) => setLot(next));

  // Đặt giá: useForm bind op placeBid; lotId cố định (initial), amount từ input number (coerce).
  const form = api.placeBid.useForm({ initial: { lotId: lot.id } });
  const closed = lot.status !== "live";

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h1>{lot.title}</h1>
      <p className="muted">{lot.description}</p>
      <p style={{ fontSize: 22 }}>Giá hiện tại: <b>{fmt(lot.currentPrice)}</b>
        {lot.currentLeader ? <span className="muted"> · đang dẫn: {lot.currentLeader.slice(0, 6)}…</span> : null}</p>
      <p className="muted">Trạng thái: {lot.status} · đóng lúc {new Date(lot.endsAt).toLocaleTimeString()}</p>

      {closed ? (
        <p className="muted">⚑ Phiên đã đóng{lot.status === "sold" ? " — đã bán." : "."}</p>
      ) : (
        <form onSubmit={form.handleSubmit} className="row" style={{ gap: 8 }}>
          <input type="number" {...form.register("amount")} placeholder={`> ${lot.currentPrice}`} />
          <button type="submit" disabled={form.submitting}>Đặt giá</button>
        </form>
      )}
      {form.errors.amount ? <p style={{ color: "crimson" }}>{form.errors.amount}</p> : null}
      {form.formError ? <p style={{ color: "crimson" }}>{form.formError}</p> : null}

      <p style={{ marginTop: 16 }}><Link href="/lots" className="muted">← danh sách phiên</Link></p>
    </div>
  );
}

export default LotDetail;
