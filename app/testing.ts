// Test spy cho Backend của app — mock CRUD mà KHÔNG cần HTTP/DB.
// Vì Backend là interface (app/backend.ts), mock cực dễ: seed + .calls + .failNext.
import type { Backend, Todo, Lot, Bid } from "./backend/data";
import { BidError } from "./backend/data";

export interface TestBackend extends Backend {
  calls: { method: string; args: unknown[] }[];
  failNext(method: "listTodos" | "addTodo" | "toggleTodo", error?: Error): void;
}

export function createTestBackend(initial: Todo[] = []): TestBackend {
  let todos: Todo[] = initial.map((t) => ({ ...t }));
  let seq = initial.length + 1;
  let lots: Lot[] = [];
  let bids: Bid[] = [];
  let lseq = 1, bseq = 1;
  const calls: { method: string; args: unknown[] }[] = [];
  const failures: Record<string, Error | undefined> = {};

  const guard = (method: string) => {
    const e = failures[method];
    if (e) { failures[method] = undefined; throw e; }
  };

  return {
    name: "test",
    calls,
    failNext(method, error = new Error(`test fail: ${method}`)) {
      failures[method] = error;
    },
    async listTodos() {
      calls.push({ method: "listTodos", args: [] });
      guard("listTodos");
      return todos.map((t) => ({ ...t }));
    },
    async addTodo(title) {
      calls.push({ method: "addTodo", args: [title] });
      guard("addTodo");
      const t: Todo = { id: String(seq++), title, done: false };
      todos = [...todos, t];
      return { ...t };
    },
    async toggleTodo(id) {
      calls.push({ method: "toggleTodo", args: [id] });
      guard("toggleTodo");
      todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
      return todos.map((t) => ({ ...t }));
    },

    async listLots() { calls.push({ method: "listLots", args: [] }); return lots.map((l) => ({ ...l })); },
    async getLot(id) { calls.push({ method: "getLot", args: [id] }); const l = lots.find((x) => x.id === id); return l ? { ...l } : null; },
    async createLot(input) {
      calls.push({ method: "createLot", args: [input] });
      const lot: Lot = { id: String(lseq++), ...input, currentPrice: input.startPrice, currentLeader: null, status: "live" };
      lots = [...lots, lot];
      return { ...lot };
    },
    async placeBid({ lotId, bidderId, amount }) {
      calls.push({ method: "placeBid", args: [lotId, bidderId, amount] });
      const lot = lots.find((l) => l.id === lotId);
      if (!lot) throw new BidError("Lot không tồn tại");
      if (lot.status !== "live") throw new BidError("Phiên đã đóng");
      if (amount <= lot.currentPrice) throw new BidError(`Giá phải lớn hơn ${lot.currentPrice}`);
      const previousLeader = lot.currentLeader;
      const bid: Bid = { id: String(bseq++), lotId, bidderId, amount, at: 0 };
      bids = [...bids, bid];
      lot.currentPrice = amount; lot.currentLeader = bidderId;
      return { bid, lot: { ...lot }, previousLeader };
    },
    async closeLot(id) {
      calls.push({ method: "closeLot", args: [id] });
      const lot = lots.find((l) => l.id === id);
      if (!lot) throw new BidError("Lot không tồn tại");
      if (lot.status === "live") lot.status = lot.currentLeader ? "sold" : "cancelled";
      return { ...lot };
    },
    async listBids(lotId) { calls.push({ method: "listBids", args: [lotId] }); return bids.filter((b) => b.lotId === lotId).map((b) => ({ ...b })); },
  };
}
