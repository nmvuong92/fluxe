// Trạng thái đăng nhập ở header — useSession (đọc /__session host gắn). Đăng xuất gọi better-auth.
import { useSession } from "@nmvuong92/fluxe/react";

export function AuthStatus() {
  const { data, status } = useSession<{ user: string; roles: string[] }>();
  if (status === "loading") return null;

  async function signOut() {
    await fetch("/api/auth/sign-out", { method: "POST" });
    location.href = "/";
  }

  if (!data) {
    return (
      <span style={{ marginLeft: 8, fontSize: 13 }}>
        <a href="/sign-in">Đăng nhập</a> · <a href="/sign-up">Đăng ký</a>
      </span>
    );
  }
  return (
    <span style={{ marginLeft: 8, fontSize: 13 }}>
      {data.user} <span className="muted">({data.roles?.[0]})</span>{" "}
      <button onClick={signOut} style={{ cursor: "pointer", background: "none", border: "1px solid #30363d", borderRadius: 6, padding: "1px 6px", color: "inherit" }}>Đăng xuất</button>
    </span>
  );
}

export default AuthStatus;
