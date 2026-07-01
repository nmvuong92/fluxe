import { useState } from "react";

// Gọi thẳng endpoint better-auth (/api/auth/*) — provider lo password/session/cookie.
// Không ship better-auth xuống browser: chỉ fetch JSON, cookie do server set.
export function SignUp() {
  const [f, setF] = useState({ email: "", password: "", name: "", role: "bidder" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/auth/sign-up/email", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f),
    });
    setBusy(false);
    if (r.ok) { location.href = "/lots"; return; }
    const b = await r.json().catch(() => ({}));
    setErr(b?.message || b?.error?.message || `Đăng ký thất bại (${r.status})`);
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h1>Đăng ký</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>Tên<input value={f.name} onChange={set("name")} placeholder="Tên của bạn" /></label>
        <label>Email<input type="email" value={f.email} onChange={set("email")} placeholder="you@example.com" /></label>
        <label>Mật khẩu<input type="password" value={f.password} onChange={set("password")} placeholder="≥ 8 ký tự" /></label>
        <label>Vai trò
          <select value={f.role} onChange={set("role")}>
            <option value="bidder">Người mua (bidder)</option>
            <option value="seller">Người bán (seller)</option>
          </select>
        </label>
        {err ? <p style={{ color: "crimson" }}>{err}</p> : null}
        <button type="submit" disabled={busy}>{busy ? "Đang tạo…" : "Đăng ký"}</button>
      </form>
      <p className="muted" style={{ marginTop: 10 }}>Đã có tài khoản? <a href="/sign-in">Đăng nhập</a></p>
    </div>
  );
}

export default SignUp;
