/* Demo SỐNG cho docs — chạy ngay trong trình duyệt (island), mock backend in-memory, 0 network.
 * Tái hiện đúng UX của cell `tasks`: useQuery(initial) + useMutation + validate + trace DebugBar. */
import { useState } from "react";

interface Todo {
  id: string;
  title: string;
}

interface Trace {
  label: string;
  ms: number;
  ok: boolean;
}

let seq = 2;

export default function TasksDemo() {
  const [items, setItems] = useState<Todo[]>([
    { id: "1", title: "Học fluxe" },
    { id: "2", title: "Tạo cell đầu tiên" },
  ]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [trace, setTrace] = useState<Trace[]>([]);

  function log(label: string, ok: boolean) {
    const ms = 1 + Math.round(Math.random() * 3); // giả lập in-process ~1-4ms
    setTrace((t) => [{ label, ms, ok }, ...t].slice(0, 4));
  }

  function onAdd() {
    // withInput(z.string().min(1)) — validate giống server
    if (title.trim().length === 0) {
      setError("Không được rỗng");
      log("rpc:tasks.add", false);
      return;
    }
    setError("");
    seq += 1;
    setItems((xs) => [...xs, { id: String(seq), title: title.trim() }]);
    setTitle("");
    log("rpc:tasks.add", true);
    log("query:tasks", true);
  }

  const box: React.CSSProperties = {
    border: "1px solid var(--sl-color-gray-5)",
    borderRadius: 8,
    padding: "12px 14px",
    background: "var(--sl-color-gray-6)",
    margin: "0.5rem 0 1rem",
  };
  const input: React.CSSProperties = {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid var(--sl-color-gray-5)",
    background: "var(--sl-color-black)",
    color: "var(--sl-color-white)",
    marginRight: 6,
  };
  const btn: React.CSSProperties = {
    padding: "4px 12px",
    borderRadius: 6,
    border: "none",
    background: "var(--sl-color-accent)",
    color: "var(--sl-color-white)",
    cursor: "pointer",
  };

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <strong>Tasks</strong>
        <span style={{ fontSize: 11, color: "var(--sl-color-gray-3)" }}>(demo sống — chạy trong trình duyệt)</span>
      </div>

      <div>
        <input
          style={input}
          value={title}
          placeholder="việc mới…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
        />
        <button style={btn} onClick={onAdd}>Thêm</button>
      </div>
      {error && <p style={{ color: "var(--sl-color-red)", margin: "6px 0 0", fontSize: 13 }}>{error}</p>}

      <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
        {items.map((t) => (
          <li key={t.id}>{t.title}</li>
        ))}
      </ul>

      {trace.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "1px solid var(--sl-color-gray-5)", paddingTop: 6, fontSize: 12, fontFamily: "ui-monospace, monospace" }}>
          <div style={{ color: "var(--sl-color-gray-3)", marginBottom: 2 }}>⚡ DebugBar (mô phỏng)</div>
          {trace.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, color: "var(--sl-color-gray-2)" }}>
              <span style={{ color: t.ok ? "var(--sl-color-green)" : "var(--sl-color-red)" }}>{t.ok ? "●" : "●"}</span>
              <span style={{ flex: 1 }}>{t.label}</span>
              <span style={{ color: "#5fd3f0" }}>memory/in-process</span>
              <span style={{ color: "var(--sl-color-gray-3)" }}>{t.ms}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
