import { api } from "../../api";

export interface NewLotData {}

// endsAt mặc định = 30 phút nữa (epoch ms); select đổi qua setValue.
const inMinutes = (m: number) => Date.now() + m * 60_000;

export function NewLot() {
  // useForm bind vào op createLot: field typed, lỗi Zod server → từng field, submit = gọi api typed.
  const form = api.createLot.useForm({
    initial: { endsAt: inMinutes(30) },
    onSuccess: () => { location.href = "/lots"; },
  });

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Tạo phiên đấu giá</h1>
      <form onSubmit={form.handleSubmit} className="col" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>Tên món
          <input {...form.register("title")} placeholder="vd: Đồng hồ cổ" />
          {form.errors.title ? <small style={{ color: "crimson" }}>{form.errors.title}</small> : null}
        </label>
        <label>Mô tả
          <input {...form.register("description")} placeholder="Mô tả ngắn" />
          {form.errors.description ? <small style={{ color: "crimson" }}>{form.errors.description}</small> : null}
        </label>
        <label>Giá khởi điểm
          <input type="number" {...form.register("startPrice")} placeholder="100" />
          {form.errors.startPrice ? <small style={{ color: "crimson" }}>{form.errors.startPrice}</small> : null}
        </label>
        <label>Thời lượng
          <select defaultValue="30" onChange={(e) => form.setValue("endsAt", inMinutes(Number(e.target.value)))}>
            <option value="10">10 phút</option>
            <option value="30">30 phút</option>
            <option value="60">60 phút</option>
          </select>
        </label>
        {form.formError ? <p style={{ color: "crimson" }}>{form.formError}</p> : null}
        <button type="submit" disabled={form.submitting}>{form.submitting ? "Đang tạo…" : "Tạo phiên"}</button>
      </form>
    </div>
  );
}

export default NewLot;
