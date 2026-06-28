// Chuông thông báo realtime — subscribe topic `notif:<userId>` (server publish khi bị vượt giá).
// Client-safe: chỉ dùng hook @nmvuong92/fluxe/react (useSession + useSubscription).
import { useState } from "react";
import { useSession, useSubscription } from "@nmvuong92/fluxe/react";

interface Note { type: string; lotId: string; title: string; amount: number }

export function NotifBell() {
  const { data } = useSession<{ id: string }>();   // /__session (host gắn) → biết user id
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  // Topic theo user; data=null lúc loading → topic vô hại, đổi khi session về (useSubscription re-sub theo op).
  useSubscription<Note>(data ? `notif:${data.id}` : "notif:__anon", (n) => setNotes((c) => [n, ...c].slice(0, 8)));

  if (!data) return null;
  return (
    <span style={{ position: "relative", marginLeft: 8 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ cursor: "pointer", background: "none", border: "none", fontSize: 16 }}>
        🔔{notes.length ? <sup style={{ color: "crimson" }}>{notes.length}</sup> : null}
      </button>
      {open && notes.length ? (
        <div style={{ position: "absolute", right: 0, top: "100%", background: "#fff", color: "#111", border: "1px solid #ccc", borderRadius: 8, padding: 8, minWidth: 240, zIndex: 50, boxShadow: "0 4px 16px #0003" }}>
          {notes.map((n, i) => (
            <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid #eee", fontSize: 13 }}>
              Bị vượt giá ở <b>{n.title}</b> → ${n.amount}
            </div>
          ))}
        </div>
      ) : null}
    </span>
  );
}

export default NotifBell;
