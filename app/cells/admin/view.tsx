import { createElement as h } from "react";

export interface AdminData { user: string; roles: string[] }

export function Admin({ data }: { data: AdminData }) {
  return h("div", { className: "card" },
    h("h1", null, "Trang quản trị"),
    h("p", null, `Admin: ${data.user} — roles: ${data.roles.join(", ")}`)
  );
}

export default Admin;
