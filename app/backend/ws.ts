// WEBSOCKET (host-owned) — fluxe KHÔNG làm WS (realtime của nó = SSE). Đây là minh hoạ:
// host mount WS 2-CHIỀU (chat phòng đấu giá) NGAY TRÊN http server của Express, cạnh fluxe.
// Bonus: bridge broker CHUNG của fluxe → WS, nên 1 kết nối WS vừa chat vừa nhận realtime giá
// (cùng bus với /__sse). Chứng minh fluxe không cản host + chia sẻ hạ tầng realtime.
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";
import { broker } from "./broker";

const rooms = new Map<string, Set<WebSocket>>();
const broadcast = (lot: string, data: unknown) => {
  const msg = JSON.stringify(data);
  rooms.get(lot)?.forEach((c) => c.readyState === WebSocket.OPEN && c.send(msg));
};

export function attachWs(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });   // upgrade riêng path /ws → không đụng fluxe

  wss.on("connection", (ws, req) => {
    const lot = new URL(req.url ?? "", "http://x").searchParams.get("lot") ?? "";
    if (!lot) return ws.close();

    let set = rooms.get(lot);
    if (!set) rooms.set(lot, (set = new Set()));
    set.add(ws);

    // Bridge: fluxe publish `lot:<id>` (placeBid /__rpc HOẶC job đóng phiên) → đẩy xuống WS room.
    const off = broker.subscribe(`lot:${lot}`, (data: any) => ws.readyState === WebSocket.OPEN
      && ws.send(JSON.stringify({ type: "price", price: data?.currentPrice, status: data?.status })));

    ws.send(JSON.stringify({ type: "system", text: `Đã vào phòng đấu giá #${lot}` }));

    ws.on("message", (raw) => {
      try {
        const m = JSON.parse(String(raw));
        if (m.type === "chat" && typeof m.text === "string" && m.text.trim()) {
          broadcast(lot, { type: "chat", from: String(m.from ?? "khách").slice(0, 40), text: m.text.slice(0, 200), at: Date.now() });
        }
      } catch { /* bỏ frame hỏng */ }
    });

    ws.on("close", () => { off(); set!.delete(ws); if (!set!.size) rooms.delete(lot); });
  });

  console.log("[ws] WebSocket chat 2-chiều mounted at /ws?lot=<id> (host-owned, cạnh fluxe)");
  return wss;
}
