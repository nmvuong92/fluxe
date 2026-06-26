# fluxe — khung fullstack tối giản

React + SSR + island hydration + API mode + switch backend. Không Nginx, server tự phục vụ.

## Chạy
```bash
npm install
npm run typecheck        # type-safe end-to-end
npm run dev              # http://localhost:5180  (backend: memory)
npm run dev:remote       # đổi sang backend "remote-go" — frontend KHÔNG đổi
npm test                 # kiểm tra 6 yêu cầu với cả 2 backend
```

## 6 yêu cầu — cách giải

1. **API hóa được**: mọi route thêm `?json=1` (hoặc header `x-fluxe:1`) → trả JSON thuần thay vì HTML. Cùng một loader.
2. **Nhanh hơn / đơn giản hơn Next**: Vite/esbuild + island hydration (chỉ gửi JS cho cell `island`, cell `static` = 0 JS). Không RSC.
3. **JSX tương thích**: React `.tsx` bình thường.
4. **Giống Inertia**: server chạy loader → truyền props thẳng vào React component. Không viết fetch để lấy data trang.
5. **Interactive**: cell `island` hydrate, có state + action server qua `rpc()`.
6. **Switch backend**: loader/action chỉ gọi interface `Backend`. Đổi `FLUXE_BACKEND=remote|go|rust` → chạy implementation khác. Cell + frontend không sửa dòng nào.

## Backend đa ngôn ngữ — service Go & Rust THẬT (đã chạy)

Interface `Backend` là điểm switch. Ngoài backend TS (memory), có service **thật** viết bằng ngôn ngữ khác (Go, Rust), nói chuyện qua HTTP với cùng "hợp đồng":

```
GET  /todos               → Todo[]
POST /todos {title}       → Todo
POST /todos/{id}/toggle   → Todo[]
```

- `app/native/go/`   — service Go (net/http, stdlib).        Port 8081.
- `app/native/rust/` — service Rust (TcpListener, std, 0 dep). Port 8082.
- `src/backends/http.ts`  — adapter TS `createHttpBackend()` implement interface `Backend` bằng `fetch`.

Chứng minh (build + chạy cả 2 service, rồi chạy cùng một hàm qua interface trên cả 3):
```bash
./run-native.sh          # cần go + rustc trong PATH
```

Dùng trong server SSR thật (sau `npm install`):
```bash
( cd app/native/go && PORT=8081 go run . ) &       # hoặc service Rust
FLUXE_BACKEND=go npm run dev                             # frontend/cell KHÔNG đổi
```

## Cấu trúc
```
src/
  backends/
    types.ts       interface Backend  ← điểm switch
    memory.ts      backend #1 (TS thuần)
    remote.ts      backend #2 (giả lập Go từ xa, cùng interface)
  core/
    engine.ts      defineCell (loader/action/view/hydration/route)
    client.ts      rpc() + fetchPageProps() — Inertia-style, không viết fetch tay
  cells/
    home/          hydration static → 0 JS
    todos/         hydration island → interactive
  server_factory.ts  SSR + API mode + action RPC + chọn backend
  client.tsx         hydrate island
```

## Kết quả đã verify (chạy thật)
- /        : static, KHÔNG gửi client.js (0 JS).
- /todos   : island, SSR sẵn list + gửi client.js để hydrate.
- ?json=1  : trả JSON props.
- x-fluxe:1: trả props JSON cho SPA navigation (Inertia-style).
- action add: tạo todo qua RPC, lưu vào backend.
- Đổi memory ↔ remote-go: chỉ đổi 1 env, frontend/cell giữ nguyên.
