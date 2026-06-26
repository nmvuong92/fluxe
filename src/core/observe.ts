/* Observability — request log ring buffer (seed của debug bar 4l + dashboard 4j).
 * Ghi method/path/status/ms mỗi request; phơi ở /_fluxe/requests. Bản 1-node in-memory;
 * production: đẩy sang OTel/structured-log (gắn 4i), cùng điểm record. */

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
  const buf: ReqLog[] = [];
  return {
    record(e) {
      buf.push(e);
      if (buf.length > max) buf.shift();
    },
    recent(n = 50) {
      return buf.slice(-n).reverse(); // mới nhất trước
    },
  };
}
