/* Broker pub/sub in-memory — nền của realtime channel (Trục 4g), bản 1-node.
 * Bản distributed: thay bằng NATS/Redis fan-out (cùng interface). Bản stateful:
 * actor-Go (app/native/actor-go). Đây là lõi đơn giản nhất, dependency-free. */

export type Subscriber = (data: unknown) => void;

export interface Broker {
  subscribe(topic: string, fn: Subscriber): () => void;
  publish(topic: string, data: unknown): void;
  count(topic: string): number;
}

export function createBroker(): Broker {
  const subs = new Map<string, Set<Subscriber>>();
  return {
    subscribe(topic, fn) {
      let set = subs.get(topic);
      if (!set) { set = new Set(); subs.set(topic, set); }
      set.add(fn);
      return () => {
        set!.delete(fn);
        if (set!.size === 0) subs.delete(topic);
      };
    },
    publish(topic, data) {
      subs.get(topic)?.forEach((fn) => fn(data));
    },
    count(topic) {
      return subs.get(topic)?.size ?? 0;
    },
  };
}
