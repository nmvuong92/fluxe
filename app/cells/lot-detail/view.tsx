import { useState, useEffect, useRef } from "react";
import { Link, useSubscription, useSession } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
import type { Lot, Bid } from "../../backend/data";

export interface LotDetailData { lot: Lot; bids: Bid[] }

const fmt = (n: number) => "$" + n.toLocaleString();

interface ChatLine { type: string; from?: string; text: string; at?: number }

export function LotDetail({ data }: { data: LotDetailData }) {
  const [lot, setLot] = useState<Lot>(data.lot);
  // Realtime (FLUXE = SSE): ai đặt giá → server publish `lot:<id>` (Lot mới) → cập nhật live, typed.
  useSubscription<Lot>(`lot:${data.lot.id}`, (next) => setLot(next));

  // Đặt giá: useForm bind op placeBid; lotId cố định (initial), amount từ input number (coerce).
  const form = api.placeBid.useForm({ initial: { lotId: lot.id } });
  const closed = lot.status !== "live";

  // ── WEBSOCKET (HOST = ws 2-chiều): chat phòng + nhận relay giá từ broker chung của fluxe ──
  const { data: session } = useSession<{ user: string }>();
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (typeof WebSocket === "undefined") return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws?lot=${data.lot.id}`);
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "chat") setChat((c) => [...c, m]);
      else if (m.type === "system") setChat((c) => [...c, m]);
      else if (m.type === "price") setChat((c) => [...c, { type: "price", text: `💰 giá qua WS: $${m.price} (${m.status})` }]);
    };
    return () => ws.close();
  }, [data.lot.id]);
  function sendChat(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!text.trim()) return;
    wsRef.current?.send(JSON.stringify({ type: "chat", from: session?.user ?? "khách", text }));
    setText("");
  }

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

      {/* CHAT qua WebSocket (host) — 2-chiều, cạnh realtime giá qua SSE (fluxe) */}
      <div style={{ marginTop: 20, borderTop: "1px solid #30363d", paddingTop: 12 }}>
        <h3 style={{ margin: "0 0 6px" }}>💬 Chat phòng <span className="muted" style={{ fontSize: 12 }}>(WebSocket)</span></h3>
        <div style={{ height: 140, overflow: "auto", background: "#0d1117", borderRadius: 8, padding: 8, fontSize: 13 }}>
          {chat.length === 0 ? <div className="muted">Chưa có tin nhắn. Mở 2 tab để thử realtime 2-chiều.</div> : null}
          {chat.map((m, i) => (
            <div key={i} style={{ padding: "2px 0", color: m.type === "system" ? "#7d8590" : m.type === "price" ? "#a371f7" : "#e6edf3" }}>
              {m.type === "chat" ? <b>{m.from}: </b> : null}{m.text}
            </div>
          ))}
        </div>
        <form onSubmit={sendChat} className="row" style={{ gap: 8, marginTop: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Nhắn (${session?.user ?? "khách"})…`} />
          <button type="submit">Gửi</button>
        </form>
      </div>

      <p style={{ marginTop: 16 }}><Link href="/lots" className="muted">← danh sách phiên</Link></p>
    </div>
  );
}

export default LotDetail;
