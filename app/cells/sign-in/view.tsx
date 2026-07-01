import { useState } from "react";

export function SignIn() {
  const [f, setF] = useState({ email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/auth/sign-in/email", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f),
    });
    setBusy(false);
    if (r.ok) { location.href = "/lots"; return; }
    const b = await r.json().catch(() => ({}));
    setErr(b?.message || b?.error?.message || `Sai email hoặc mật khẩu (${r.status})`);
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h1>Đăng nhập</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>Email<input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" /></label>
        <label>Mật khẩu<input type="password" value={f.password} onChange={set("password")} placeholder="Mật khẩu" /></label>
        {err ? <p style={{ color: "crimson" }}>{err}</p> : null}
        <button type="submit" disabled={busy}>{busy ? "Đang vào…" : "Đăng nhập"}</button>
      </form>
      <p className="muted" style={{ marginTop: 10 }}>Chưa có tài khoản? <a href="/sign-up">Đăng ký</a></p>
    </div>
  );
}

export default SignIn;
