# fluxe — Resolver Core (RCA) — Design Spec

**Ngày:** 2026-06-26
**Trạng thái:** Đã duyệt brainstorm, chờ review spec
**Phạm vi:** PoC nền tảng cho RCA — Resolver core (Resolution Plane v0.1)

---

## 1. Mục tiêu & bối cảnh

fluxe là khung fullstack tối giản đã có (xem `README.md`, `src/`). Triết lý di sản
**RCA — Resolved Cell Architecture**: *logic chỉ phụ thuộc HỢP ĐỒNG, mọi quyết định vận
hành là kết quả được GIẢI (resolved)*. Hiện đã chứng minh được biên `Backend` polyglot
(memory ↔ Go ↔ Rust qua HTTP, cell không đổi — xem `native/`, `run-native.sh`).

PoC này chứng minh **Resolver** — bộ não của Resolution Plane — là khả thi, biến các
quyết định vận hành đang nằm rải rác (if-check trong `server_factory.ts`) thành **một pass
resolve thuần → một Resolution Manifest → runtime chỉ đọc**.

**Tiêu chí thành công:** cùng một bộ cell + contract, đổi một **profile config** →
**Resolution Manifest khác → hành vi runtime khác** (render + backend + transport), mà
**không sửa một dòng code cell nào**.

### Quyết định đã chốt (brainstorm)
1. Dựng **Resolver core** trước (đòn bẩy cao nhất; cả kiến trúc treo lên nó).
2. Cơ chế **declaration + resolution**: dev khai báo ý định trong `defineCell`/profile;
   Resolver giải phần cụ thể. (Không inference trong v0.1.)
3. **Build-time → Resolution Manifest** dạng file inspectable (`.fluxe/resolution.json`);
   runtime chỉ đọc. Khớp tenet T2 (prod = artifact bất biến) + nguyên tắc inspectable/eject.

---

## 2. Phạm vi

### Trong phạm vi — 3 trục RCA
- **Render**: `static` (0 JS) | `island` (ship `client.js` + hydrate).
- **Language/Location backend**: `memory` (in-proc TS) | `go` | `rust` (HTTP service).
- **Transport**: suy ra (`memory` → `in-process`; `go`/`rust` → `http` + endpoint).

### Ngoài phạm vi (YAGNI — bản sau)
- Inference tự động (phân tích AST quyết định static/island).
- Backend per-cell; các trục Scale / State-driver; transport gRPC / FlatBuffers.
- Code-split JS thật per-cell (v0.1 giữ một `client.js` cho mọi island).
- Codegen Go/Rust types (PoC riêng).
- HMR re-resolve (v0.1 chỉ build-time).
- Panel RCA trong dashboard (manifest là nguồn dữ liệu cho nó sau).
- **Profile-Guided Resolution** (profiling feed ngược Resolver — xem idea.md §4f): ngoài
  phạm vi v0.1, nhưng **manifest + `resolve()` là điểm cắm tự nhiên** — sau này `resolve()`
  nhận thêm input "profile data" như một nguồn của ma trận giải. Thiết kế v0.1 không cản đường nó.

---

## 3. Kiến trúc & luồng dữ liệu

```
cells[] + profile  ──►  [ resolve()  (thuần, build-time) ]  ──►  .fluxe/resolution.json
                                                                        │
                                              makeServer(manifest) đọc ◄┘
                                                                        │
                                   mỗi request: render theo manifest + Backend theo manifest
```

Trọng tâm chứng minh: **gom mọi quyết định vào một pass `resolve()` thuần** → xuất
manifest → runtime chỉ tiêu thụ. Đây là ranh giới biến "switch ad-hoc" thành "RCA thật".

---

## 4. Thành phần & interface

### 4.1 ResolutionProfile (input app-level)
```ts
interface ResolutionProfile {
  name: string;                                  // "dev" | "prod-go" … để truy vết
  backend: "memory" | "go" | "rust";             // chọn backend
  endpoints?: { go?: string; rust?: string };    // dùng khi transport = http
}
```

### 4.2 ResolutionManifest (output, ghi `.fluxe/resolution.json`)
```ts
interface ResolutionManifest {
  version: 1;
  profile: string;
  backend: {                                     // app-level (v0.1: 1 backend)
    language: "memory" | "go" | "rust";
    transport: "in-process" | "http";
    endpoint?: string;                           // bắt buộc khi http
  };
  cells: Record<string, {
    id: string; route: string;
    render: { mode: "static" | "island"; shipClientJs: boolean };
  }>;
}
```

### 4.3 resolve() — hàm Resolver (thuần, build-time)
```ts
function resolve(cells: CellDef<any, any>[], profile: ResolutionProfile): ResolutionManifest
```
Logic:
- **Render**: `cell.hydration` → `mode`; `shipClientJs = (mode === "island")`.
- **Backend/Transport**: `profile.backend` → `language`; `memory` → `in-process`,
  `go`/`rust` → `http` + `endpoint` lấy từ `profile.endpoints`.
- **Validate fail-fast** (tenet T4), ném lỗi rõ ràng lúc build:
  - route hoặc id trùng giữa các cell;
  - `transport === "http"` mà thiếu endpoint tương ứng;
  - `profile.backend` ngoài tập cho phép.

### 4.3b Định dạng manifest & hiệu năng (chốt: JSON — đừng tối ưu nhầm chỗ)
- Manifest là **artifact build-time, đọc 1 lần lúc boot**, kích thước nhỏ (vài cell) →
  **KHÔNG nằm trên hot path**. Đổi sang binary (FlatBuffers/msgpack) ở đây gần như **0 lợi
  ích** mà **mất inspectability** (mục tiêu đã chọn) → sai tradeoff. **Giữ JSON.**
- Phân biệt: **manifest** = config boot-time (JSON đúng); **wire data per-request** SSR↔backend
  = chỗ zero-copy/FlatBuffers mới đáng (mục 2 idea.md) — RAM/CPU/RPS nằm ở đó, không phải manifest.
- **Tối ưu thật (per-request)**: runtime **parse manifest 1 lần → dựng bảng in-memory phẳng**
  (Map/array index theo route) → mỗi request **O(1) lookup, 0 alloc, 0 re-parse**.
- **Tùy chọn tương lai (NGOÀI v0.1)**: compile manifest → **code sinh ra** (`.fluxe/resolution.ts`
  export const có kiểu) → 0 parse lúc boot, vẫn inspectable (như Next/Nuxt route manifest).
  Chỉ tiết kiệm vài ms boot — chưa đáng cho PoC.

### 4.4 Runtime — `makeServer(manifest)` (refactor `src/server_factory.ts`)
- **Backend**: từ `manifest.backend` → `createMemoryBackend()` hoặc
  `createHttpBackend(language, endpoint)`. Thay khối `switch (backendEnv)`.
- **Render**: mỗi request dùng `manifest.cells[id].render.shipClientJs` để quyết định nhúng
  `client.js`. Thay `cell.hydration === "island"`.
- Cell vẫn khai báo `hydration`, nhưng runtime **tin manifest** (một nguồn sự thật đã giải).
- Nếu manifest thiếu/không hợp lệ → server từ chối boot (fail-fast).

### 4.5 Build step — `scripts/resolve.ts`
- Chạy `resolve(cells, profile)` với profile chọn qua arg/env → ghi `.fluxe/resolution.json`.
- (Tương lai gói thành lệnh `fx resolve`.)

---

## 5. Module layout (xây trên file đã có)

| File | Trạng thái | Vai trò |
|------|-----------|---------|
| `src/core/resolver.ts` | mới | types (Profile/Manifest) + `resolve()` thuần |
| `src/profiles.ts` | mới | khai báo profile `dev` / `prod-go` / `prod-rust` |
| `scripts/resolve.ts` | mới | chạy resolver → ghi `.fluxe/resolution.json` |
| `src/server_factory.ts` | sửa | `makeServer(manifest)` đọc manifest thay if-check |
| `.fluxe/resolution.json` | sinh ra | artifact (gitignore hoặc commit tuỳ sau) |
| `src/core/engine.ts` | giữ | `CellDef` (không đổi) |
| `src/backends/*` | giữ | memory + http backend (đã có) |

---

## 6. Error handling

- **Resolver (build-time)**: validate đầu vào, ném lỗi mô tả rõ (cái gì sai, cell/profile
  nào). Không bao giờ xuất manifest "nửa vời".
- **Runtime (boot)**: manifest thiếu hoặc lệch schema → từ chối khởi động, in lỗi rõ.
- Triết lý: lỗi cấu hình lộ ra **lúc build/boot**, không để chết giữa request (tenet T4).

---

## 7. Testing (tenet T4 — không xong nếu thiếu test)

1. **Unit — `src/core/resolver.test.ts`** (`resolve()` thuần, dễ test):
   - Ca hợp lệ: profile `memory` → in-process; `go` → http + endpoint; render map đúng.
   - Ca fail-fast: backend lạ; http thiếu endpoint; route/id trùng → ném lỗi đúng.
2. **Integration — mở rộng `src/selftest2.ts`**:
   - `resolve()` với 2 profile (`dev`=memory, `prod-go`=Go HTTP) → khẳng định manifest khác
     đúng chỗ (backend.transport/endpoint; cells.render giữ nguyên).
   - Boot server theo mỗi manifest → khẳng định: cell `static` không ship JS, cell `island`
     ship JS; backend gọi đúng memory vs Go service; **cell KHÔNG đổi dòng nào**.
3. **Inspectability**: in `.fluxe/resolution.json` ra — xác nhận human-readable (tiền đề panel RCA).

**Cách chạy (rõ ràng):**
- **Unit test `resolve()`**: thuần, chỉ builtin → chạy bằng Node chạy TS native, **không cần
  `npm install`** (đã xác nhận trong session).
- **Integration (boot server)**: `makeServer` render SSR bằng React → **cần `npm install`**
  trước (react/react-dom). Đây là phụ thuộc bắt buộc, plan sẽ ghi bước này.

---

## 8. Tiêu chí hoàn thành (Definition of Done)

- [ ] `resolve()` thuần + types, có unit test (gồm ca fail-fast) xanh.
- [ ] `makeServer` đọc manifest; bỏ if-check backend/hydration rải rác.
- [ ] `scripts/resolve.ts` sinh `.fluxe/resolution.json` đúng theo profile.
- [ ] Integration: 2 profile → 2 manifest → 2 hành vi, cell không đổi → chứng minh RCA.
- [ ] Manifest in ra human-readable.
- [ ] README/spec mô tả cách chạy (tenet T4: doc kèm theo).
