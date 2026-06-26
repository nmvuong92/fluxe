/* Presence — ai đang online per topic (Trục 4g). Refcount theo id để chịu multi-tab/
 * nhiều kết nối cùng user. Bản 1-node; distributed: chia sẻ qua NATS/Redis (gắn 4d). */

export interface Presence {
  join(topic: string, id: string): () => void; // trả hàm leave
  members(topic: string): string[];
  count(topic: string): number;
}

export function createPresence(): Presence {
  const topics = new Map<string, Map<string, number>>(); // topic → (id → số kết nối)

  return {
    join(topic, id) {
      let m = topics.get(topic);
      if (!m) { m = new Map(); topics.set(topic, m); }
      m.set(id, (m.get(id) ?? 0) + 1);
      return () => {
        const mm = topics.get(topic);
        if (!mm) return;
        const n = (mm.get(id) ?? 0) - 1;
        if (n <= 0) mm.delete(id); else mm.set(id, n);
        if (mm.size === 0) topics.delete(topic);
      };
    },
    members(topic) {
      return [...(topics.get(topic)?.keys() ?? [])];
    },
    count(topic) {
      return topics.get(topic)?.size ?? 0;
    },
  };
}
