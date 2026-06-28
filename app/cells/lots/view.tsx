import { Link } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
import type { Lot } from "../../backend/data";   // type-only → esbuild elide

export interface LotsData { lots: Lot[] }

const fmt = (n: number) => "$" + n.toLocaleString();

export function Lots({ data }: { data: LotsData }) {
  // initial = data SSR (không flash); useQuery cho refetch/live khi quay lại.
  const q = api.lots.useQuery({ initial: data.lots });
  const lots = q.data ?? [];

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Phiên đấu giá</h1>
        <Link href="/lots/new" className="btn">+ Tạo phiên</Link>
      </div>
      <table className="list" style={{ width: "100%" }}>
        <thead>
          <tr><th align="left">Món</th><th align="right">Giá hiện tại</th><th align="right">Đóng lúc</th><th>Trạng thái</th></tr>
        </thead>
        <tbody>
          {lots.map((l) => (
            <tr key={l.id}>
              <td><Link href={`/lots/${l.id}`}>{l.title}</Link></td>
              <td align="right">{fmt(l.currentPrice)}</td>
              <td align="right">{new Date(l.endsAt).toLocaleTimeString()}</td>
              <td align="center">{l.status}</td>
            </tr>
          ))}
          {lots.length === 0 ? <tr><td colSpan={4} className="muted">Chưa có phiên nào.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

export default Lots;
