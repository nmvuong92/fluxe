/* Observability — request log Ring Buffer CIRCULAR (#17).
 * Trước: push + shift (shift O(n) mỗi record khi đầy). Giờ: mảng vòng + con trỏ ghi →
 * record O(1) (không dời mảng). recent O(n) chỉ trên số phần tử yêu cầu. */

export interface ReqLog {
  method: string;
  path: string;
  status: number;
  ms: number;
  ts: number;
}

export interface Recorder {
  record(e: ReqLog): void;
  recent(n?: number): ReqLog[];
}

export function createRecorder(max = 200): Recorder {
  const buf = new Array<ReqLog | undefined>(max);
  let writeIdx = 0; // vị trí ghi tiếp theo
  let size = 0;

  return {
    record(e) {
      buf[writeIdx] = e;
      writeIdx = (writeIdx + 1) % max;
      if (size < max) size++;
    },
    recent(n = 50) {
      const count = Math.min(n, size);
      const out: ReqLog[] = [];
      for (let i = 0; i < count; i++) {
        out.push(buf[(writeIdx - 1 - i + max * 2) % max]!); // lùi từ mới nhất
      }
      return out; // newest-first
    },
  };
}
