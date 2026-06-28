// TẦNG DATA CỦA APP — bạn sở hữu file này (engine KHÔNG biết gì về domain này).
// Định nghĩa interface domain + implement CRUD, rồi inject qua makeServer(..., { backend }).
import { DatabaseSync } from "node:sqlite";

// ── Domain Todo (demo cũ — giữ cho test) ──────────────────────────────────────
export interface Todo { id: string; title: string; done: boolean }

// ── Domain Bidly (đấu giá) ────────────────────────────────────────────────────
export type LotStatus = "live" | "sold" | "cancelled";
export interface Lot {
  id: string;
  title: string;
  description: string;
  startPrice: number;
  currentPrice: number;
  currentLeader: string | null;   // userId người đang giữ giá cao nhất
  status: LotStatus;
  endsAt: number;                  // epoch ms — phiên đóng lúc này
  sellerId: string;
}
export interface Bid { id: string; lotId: string; bidderId: string; amount: number; at: number }
export interface PlaceBidResult { bid: Bid; lot: Lot; previousLeader: string | null }

export interface Backend {
  name: string;
  // Todo (demo cũ)
  listTodos(): Promise<Todo[]>;
  addTodo(title: string): Promise<Todo>;
  toggleTodo(id: string): Promise<Todo[]>;
  // Bidly
  listLots(): Promise<Lot[]>;
  getLot(id: string): Promise<Lot | null>;
  createLot(input: { title: string; description: string; startPrice: number; endsAt: number; sellerId: string }): Promise<Lot>;
  placeBid(input: { lotId: string; bidderId: string; amount: number }): Promise<PlaceBidResult>;
  closeLot(id: string): Promise<Lot>;
  listBids(lotId: string): Promise<Bid[]>;
}

/* Lỗi nghiệp vụ đấu giá (resolver map sang FluxeError → 400). */
export class BidError extends Error {}

const now = () => Date.now();
const minutes = (n: number) => n * 60_000;

// ── 2a) Driver in-memory (dev/test) — TS thuần, 0 hạ tầng ─────────────────────
export function memoryBackend(): Backend {
  let todos: Todo[] = [
    { id: "1", title: "Học kiến trúc fullstack", done: true },
    { id: "2", title: "Dựng app đầu tiên", done: false },
  ];
  let tseq = 3;

  const t0 = now();
  let lots: Lot[] = [
    { id: "1", title: "Đồng hồ cổ 1960", description: "Seiko vintage còn chạy tốt.", startPrice: 100, currentPrice: 100, currentLeader: null, status: "live", endsAt: t0 + minutes(30), sellerId: "seed" },
    { id: "2", title: "Tranh sơn dầu", description: "Phong cảnh, khung gỗ.", startPrice: 50, currentPrice: 50, currentLeader: null, status: "live", endsAt: t0 + minutes(10), sellerId: "seed" },
  ];
  let bids: Bid[] = [];
  let lseq = 3, bseq = 1;

  return {
    name: "memory",
    async listTodos() { return todos; },
    async addTodo(title) { const t: Todo = { id: String(tseq++), title, done: false }; todos = [...todos, t]; return t; },
    async toggleTodo(id) { todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)); return todos; },

    async listLots() { return lots.map((l) => ({ ...l })); },
    async getLot(id) { const l = lots.find((x) => x.id === id); return l ? { ...l } : null; },
    async createLot({ title, description, startPrice, endsAt, sellerId }) {
      const lot: Lot = { id: String(lseq++), title, description, startPrice, currentPrice: startPrice, currentLeader: null, status: "live", endsAt, sellerId };
      lots = [...lots, lot];
      return { ...lot };
    },
    async placeBid({ lotId, bidderId, amount }) {
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) throw new BidError("Lot không tồn tại");
      if (lot.status !== "live") throw new BidError("Phiên đã đóng");
      if (amount <= lot.currentPrice) throw new BidError(`Giá phải lớn hơn ${lot.currentPrice}`);
      const previousLeader = lot.currentLeader;
      const bid: Bid = { id: String(bseq++), lotId, bidderId, amount, at: now() };
      bids = [...bids, bid];
      lot.currentPrice = amount; lot.currentLeader = bidderId;
      return { bid, lot: { ...lot }, previousLeader };
    },
    async closeLot(id) {
      const lot = lots.find((l) => l.id === id);
      if (!lot) throw new BidError("Lot không tồn tại");
      if (lot.status === "live") lot.status = lot.currentLeader ? "sold" : "cancelled";
      return { ...lot };
    },
    async listBids(lotId) { return bids.filter((b) => b.lotId === lotId).map((b) => ({ ...b })); },
  };
}

// ── 2b) Driver SQLite (persist) — node:sqlite TRỰC TIẾP (cần --experimental-sqlite) ──
export function sqliteBackend(path = ":memory:"): Backend {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS lots (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      startPrice REAL NOT NULL, currentPrice REAL NOT NULL, currentLeader TEXT,
      status TEXT NOT NULL DEFAULT 'live', endsAt INTEGER NOT NULL, sellerId TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lotId INTEGER NOT NULL, bidderId TEXT NOT NULL,
      amount REAL NOT NULL, at INTEGER NOT NULL);
  `);
  const toTodo = (r: any): Todo => ({ id: String(r.id), title: r.title, done: !!r.done });
  const toLot = (r: any): Lot => ({ id: String(r.id), title: r.title, description: r.description, startPrice: r.startPrice, currentPrice: r.currentPrice, currentLeader: r.currentLeader, status: r.status, endsAt: r.endsAt, sellerId: r.sellerId });
  const toBid = (r: any): Bid => ({ id: String(r.id), lotId: String(r.lotId), bidderId: r.bidderId, amount: r.amount, at: r.at });
  const getLotRow = (id: string) => db.prepare("SELECT * FROM lots WHERE id = ?").get(Number(id));
  const allTodos = () => db.prepare("SELECT * FROM todos ORDER BY id").all().map(toTodo);

  return {
    name: "sqlite",
    async listTodos() { return allTodos(); },
    async addTodo(title) { const i = db.prepare("INSERT INTO todos (title) VALUES (?)").run(title); return toTodo(db.prepare("SELECT * FROM todos WHERE id = ?").get(i.lastInsertRowid)); },
    async toggleTodo(id) { db.prepare("UPDATE todos SET done = 1 - done WHERE id = ?").run(Number(id)); return allTodos(); },

    async listLots() { return db.prepare("SELECT * FROM lots ORDER BY id DESC").all().map(toLot); },
    async getLot(id) { const r = getLotRow(id); return r ? toLot(r) : null; },
    async createLot({ title, description, startPrice, endsAt, sellerId }) {
      const i = db.prepare("INSERT INTO lots (title, description, startPrice, currentPrice, endsAt, sellerId) VALUES (?,?,?,?,?,?)")
        .run(title, description, startPrice, startPrice, endsAt, sellerId);
      return toLot(getLotRow(String(i.lastInsertRowid)));
    },
    async placeBid({ lotId, bidderId, amount }) {
      const r = getLotRow(lotId);
      if (!r) throw new BidError("Lot không tồn tại");
      const lot = toLot(r);
      if (lot.status !== "live") throw new BidError("Phiên đã đóng");
      if (amount <= lot.currentPrice) throw new BidError(`Giá phải lớn hơn ${lot.currentPrice}`);
      const previousLeader = lot.currentLeader;
      const i = db.prepare("INSERT INTO bids (lotId, bidderId, amount, at) VALUES (?,?,?,?)").run(Number(lotId), bidderId, amount, now());
      db.prepare("UPDATE lots SET currentPrice = ?, currentLeader = ? WHERE id = ?").run(amount, bidderId, Number(lotId));
      return { bid: toBid(db.prepare("SELECT * FROM bids WHERE id = ?").get(i.lastInsertRowid)), lot: toLot(getLotRow(lotId)), previousLeader };
    },
    async closeLot(id) {
      const r = getLotRow(id);
      if (!r) throw new BidError("Lot không tồn tại");
      const lot = toLot(r);
      if (lot.status === "live") db.prepare("UPDATE lots SET status = ? WHERE id = ?").run(lot.currentLeader ? "sold" : "cancelled", Number(id));
      return toLot(getLotRow(id));
    },
    async listBids(lotId) { return db.prepare("SELECT * FROM bids WHERE lotId = ? ORDER BY id").all(Number(lotId)).map(toBid); },
  };
}

// ── 3) Chọn driver — đổi 1 dòng = đổi nơi lưu (memory ↔ sqlite ↔ postgres-của-bạn) ──
export const backend: Backend = process.env.FLUXE_SQLITE_PATH
  ? sqliteBackend(process.env.FLUXE_SQLITE_PATH)
  : memoryBackend();
