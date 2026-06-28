import { Link, DataTable, type Column } from "@nmvuong92/fluxe/react";
import { api } from "../../api";
import type { Lot } from "../../contract";   // kiểu suy từ contract (khớp api.lots) — type-only

export interface LotsData { lots: Lot[] }

const fmt = (n: number) => "$" + n.toLocaleString();

// View template tái dùng: khai báo cột (typed theo Lot), <DataTable> lo phần <table> lặp.
const columns: Column<Lot>[] = [
  { key: "title", label: "Món", render: (l) => <Link href={`/lots/${l.id}`}>{l.title}</Link> },
  { key: "currentPrice", label: "Giá hiện tại", align: "right", render: (l) => fmt(l.currentPrice) },
  { key: "endsAt", label: "Đóng lúc", align: "right", render: (l) => new Date(l.endsAt).toLocaleTimeString() },
  { key: "status", label: "Trạng thái", align: "center" },
];

export function Lots({ data }: { data: LotsData }) {
  const q = api.lots.useQuery({ initial: data.lots });   // initial = SSR (không flash); refetch/live
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Phiên đấu giá</h1>
        <Link href="/lots/new" className="btn">+ Tạo phiên</Link>
      </div>
      <DataTable rows={q.data ?? []} columns={columns} empty="Chưa có phiên nào." />
    </div>
  );
}

export default Lots;
