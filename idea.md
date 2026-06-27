# fluxe — Định hướng & Ý tưởng triển khai

> Tài liệu gom toàn bộ ý tưởng để phát triển fluxe thành một framework fullstack
> mạnh, có khác biệt thật, đủ sức cạnh tranh top đầu và thu hút dev.

> ⚠️ **LỖI THỜI MỘT PHẦN (2026-06-27):** Trục **polyglot** (backend Go/Rust/Java, HTTP
> sidecar, codegen đa-ngôn-ngữ) đã **GỠ** — fluxe là **một runtime TS duy nhất** (memory/
> sqlite/postgres, in-process). Xem quyết định:
> `docs/superpowers/specs/2026-06-27-remove-polyglot-single-ts-backend-design.md`.
> Các tenet **vẫn còn hiệu lực**: đo-đừng-đoán (§3/§4f), thực dụng DSA, RCA (render + data).
> Mọi đoạn nói "polyglot/Go/Rust/sidecar/single-binary compiled" dưới đây = bối cảnh lịch sử.

---

## ★ Tầm nhìn — Unified framework, all-in-one mạnh nhất hiện nay

**Một câu:** *fluxe = một binary, một mô hình tư duy, chạy từ laptop tới cluster mà
không rewrite — gói trọn frontend + backend polyglot + hạ tầng, batteries-included,
hiệu năng compiled.* Tham vọng: thứ Laravel/Rails làm cho thời của họ, fluxe làm cho
kỷ nguyên polyglot + AI + edge.

### Nguyên lý hợp nhất (thứ khiến nó là MỘT framework, không phải đống tính năng)
Mọi thứ trong fluxe quy về **một khuôn mẫu duy nhất**:
> **Một interface — nhiều implementation — chọn bằng config — polyglot — in-memory khi
> dev, cloud khi scale — không sửa code nghiệp vụ.**

Đã chứng minh thật với biên `Backend` (memory ↔ Go ↔ Rust). Cùng khuôn đó áp cho cell
(static/island), driver (queue/cache/storage/pubsub), transport, render, deploy. Một mô
hình tư duy phủ toàn hệ thống → đó là điều biến "all-in-one" thành **mạch lạc** thay vì
phình to.

### "All-in-one" gồm gì (bản đồ tới các mục)
- **UI/render**: cell static 0-JS + island React (Trục 4f, render lai tương thích React).
- **Data/RPC**: loader/action + contract codegen polyglot (mục 2), type-safe xuyên ngôn ngữ.
- **Realtime**: WebSocket + SSE + Channel native (Trục 4g).
- **Batteries**: auth/RBAC/ABAC/JWT, DB+migrations, admin, middleware/guard, rate-limit
  (6b.A, 6b.F).
- **Hạ tầng drivers**: queue/storage/cache/pubsub + NATS backbone (6b.G).
- **Nền tảng**: jobs/workflows (6b.B), AI-native (6b.C), local-first sync (Trục 3).
- **Vận hành**: single-binary + auto-TLS + scale-out K8s + service discovery (Trục 4/4b/4d/4e).
- **DX**: zero-setup, HMR polyglot, `fluxe dev` một lệnh (Trục 4c).

### Định vị một dòng so với top đầu
- **vs Next**: không khóa React/Vercel/Node — **backend polyglot Go/Rust**, single-binary.
- **vs Astro**: không chỉ site — **fullstack thật** + realtime + jobs + auth tích hợp.
- **vs Laravel/Rails**: cùng "batteries-included" nhưng **đa ngôn ngữ + compiled + edge-native**.
- **vs Wasp**: cùng "compiler + khai báo" nhưng **không khóa Node/Prisma** — polyglot là hào.

### Kỷ luật để all-in-one KHÔNG thành bloat (quan trọng)
- **Mọi mảng phải nằm sau interface + có driver in-memory** → core nhẹ, bật cái nào dùng cái đó.
- **Một mô hình tư duy** (cell + contract + driver) cho mọi thứ — không 5 khái niệm rời.
- **Progressive disclosure**: `create-fluxe` chạy được với 0 config; tính năng nâng cao opt-in.
- **Không tự viết lại hạ tầng tốt sẵn**: bọc Postgres/S3/NATS/Redis sau interface, đừng tái phát minh.
- **Đừng làm tất cả cùng lúc** — xem lộ trình (mục 7); all-in-one là *đích*, không phải *bước đầu*.

---

## ✦ Triết lý di sản — **RCA: Resolved Cell Architecture**
### *"Write the contract. Resolve the substrate."* — Viết hợp đồng, để framework chiếu xuống nền tảng.

> Đây là pattern nền tảng fluxe đặt ra — thứ MVC là của Rails, RSC là của React,
> Islands là của Astro. RCA tổng quát hơn cả ba: chúng chỉ tách **một** chiều, RCA tách
> **mọi** chiều vận hành ra khỏi logic. Đã ngầm chứng minh thật (biên `Backend`:
> memory↔Go↔Rust, cell không đổi). Việc còn lại là đặt tên và đẩy tới tận cùng.

### Định đề (một câu, là luật bất biến của framework)
> **Logic chỉ phụ thuộc HỢP ĐỒNG (contract). Không bao giờ phụ thuộc NỀN TẢNG
> (substrate).** Mọi quyết định vận hành là **kết quả được giải (resolved)**, không
> phải thứ dev viết tay.

Code hiện tại đã tuân luật này theo nghĩa đen: `cell.loader` chỉ gọi interface `Backend`,
không biết nó là TS/Go/Rust, ở đâu, qua transport gì. RCA = nâng điều đó thành nguyên lý
toàn hệ thống.

### Hai mặt phẳng (mô hình tư duy)
- **Contract Plane** — nơi dev sống: hợp đồng có kiểu + logic thuần (cell, loader, action).
  Thuần khiết, không ngôn ngữ-cụ-thể, không vị trí, không transport. Đây là *toàn bộ* thứ
  dev viết.
- **Resolution Plane** — nơi framework/compiler sống: **chiếu** mỗi hợp đồng xuống nền
  tảng cụ thể theo config + phân tích build. Dev không chạm vào.

### Ma trận giải (Resolution Matrix) — 6 chiều, độc lập, đều **late-bound**
Mỗi cell được "giải" trên 6 trục độc lập — không trục nào hardcode trong logic:

| Trục | Lựa chọn được giải | Trục cũ ai từng tách |
|------|--------------------|----------------------|
| **Language** | TS · Go · Rust · WASM | — (chưa ai tách) |
| **Location** | client · server · edge · node nào | RSC (tách tay) |
| **Transport** | in-process · HTTP · gRPC · WS · SSE | — |
| **Render** | static-HTML(0 JS) · island · stream · none | Islands (chỉ trục này) |
| **State driver** | memory · Redis · DB · S3 · NATS | — |
| **Scale** | in-process · pooled · replicas phân tán | — |

> MVC tách concern nhưng **khóa** một runtime/ngôn ngữ/vị trí. RSC tách server/client
> nhưng **trong React/Node** và phải chú thích tay. Islands late-bind **đúng 1 trục**
> (hydration). **RCA late-bind cả 6** — contract là bất biến **duy nhất**.

### Vì sao hiện đại / nhanh / tối ưu (không phải khẩu hiệu)
- **Tối ưu theo kiến tạo (optimal by construction)**: vì placement là *output của
  resolver*, compiler tự co-locate hot path, **bỏ transport khi in-process**, ship **0 JS**
  cho cell giải ra static, **đẩy logic nóng xuống Rust** — không cần dev viết lại. Tối ưu
  là việc của máy, không phải kỷ luật của người.
- **Một code, laptop→cluster không rewrite**: đổi môi trường = giải lại ma trận, không
  sửa Contract Plane. Đây là lý do "in-memory khi dev, cloud khi scale" thành tự nhiên.
- **Polyglot là hệ quả, không phải tính năng vá thêm**: Language chỉ là một trục của ma trận.

### Tại sao đáng thành di sản
Mọi trục trong tài liệu này (polyglot, compiler-placement, drivers, realtime, scale,
single-binary, CLI) **không phải 12 tính năng rời** — chúng là **các trục của cùng một
ma trận giải**. RCA là cái tên buộc tất cả thành một ý tưởng dạy được trong 1 câu, có
luật kiểm chứng được, và đã có bằng chứng chạy. Một framework để lại di sản khi nó cho
ngành **một cách nghĩ mới**, không phải một đống API.

### Cái khó thật (thành thật)
Toàn bộ độ khó dồn vào **Resolver/compiler của Resolution Plane** — bộ phân tích đồ thị
hợp đồng để giải 6 trục đúng & tối ưu. Đây chính là phần lõi đáng dựng PoC nhất (gắn
Trục 1 compiler-placement). Làm tốt Resolver = có RCA; làm hời hợt = chỉ là cấu hình.

---

## ✦ Nguyên tắc — Giao phó cho engine, vẫn override sâu được (escape-hatch 3 tầng)

Bạn-song-sinh của RCA. RCA: "mọi thứ được engine **giải**". Nguyên tắc này: dev luôn
**giành lại** được bất kỳ phần nào. Mục tiêu: **mặc định 0 code, nhưng không có bức tường** —
tránh đúng lý do dev bỏ framework (magic rò rỉ mà không có lối thoát).

### Mọi tự-động-hóa có 3 tầng (luôn có Tier 2)
- **Tier 0 — Convention (0 code)**: engine làm, default hợp lý. *Đa số dev dừng ở đây.*
- **Tier 1 — Config khai báo**: chỉnh qua option (TTL, policy, cardinality, transport…).
- **Tier 2 — Escape hatch (toàn quyền)**: viết tay phần đó (raw SQL, loader thủ công,
  transport riêng) **mà không rời framework**. Đây là tầng **bắt buộc phải có** cho mọi automation.

### Cái dev hay code → giao engine, vẫn override được (Tier 0 → đường thoát)

| Việc dev thường tự viết | Engine làm mặc định (Tier 0) | Override sâu (Tier 2) |
|--------------------------|------------------------------|------------------------|
| Fetch data trang | loader → props (Inertia) | viết loader/fetch tay |
| Chọn static/island, nơi chạy | Resolver giải (RCA) | **pin** thủ công từng trục |
| Transport/wire/serialize | auto (JSON/FB/capnp) | chỉ định per-route |
| CRUD action + admin | sinh từ schema | viết action riêng |
| Validate input | suy từ contract (Zod) | validator tùy biến |
| Cache + invalidate | auto theo entity (Wasp) | TTL/khóa/chiến lược tay |
| Pagination/filter/sort | từ query params | query thủ công |
| N+1 batching | DataLoader tự động | tự gom |
| Form + lỗi validate | suy từ schema | render/flow tự viết |
| Optimistic update | auto từ mutation→entity | reconcile tay |
| Migration | diff schema tự sinh | sửa file trước khi apply |
| Retry/backoff/cron-lock | mặc định an toàn (6b.B) | policy riêng |
| OpenAPI/types/codegen | tự sinh (mục 2) | annotate/bổ sung |
| Tracing/log/metric | auto-instrument (4i) | thêm span tùy biến |
| Loading/error boundary | tự bọc | component riêng |

### Luật cứng (để Tier 2 là thật, không phải lời hứa)
- **Không magic nào thiếu escape hatch.** Nếu engine làm X, phải có cách viết X tay.
- **Mọi cái sinh ra đều inspectable + ejectable** (`.fluxe/`, gắn 6d) — xem được, lấy ra được.
- **Override là cục bộ**: nhấc một phần xuống Tier 2 **không** kéo cả app xuống — phần khác vẫn Tier 0.
- **Cùng một API**: override không phải học framework thứ hai; chỉ là cung cấp resolution thay vì để suy.

> Vì sao quan trọng: đây là thứ cho phép "**DX như no-code, trần như full-code**" cùng lúc —
> beginner chạy bằng convention, expert mổ tới đáy. Chính là RCA nhìn từ phía dev:
> engine **đề xuất** một resolution, dev **chấp nhận hoặc thay**.

---

## ✦ Tenets — nguyên tắc bất biến (ràng buộc MỌI quyết định thiết kế)

Khác "trục tính năng": đây là **luật không thương lượng**. Tính năng nào vi phạm tenet → loại.

### T1. HTTPS-only, kể cả local — không bao giờ HTTP trần
Cài xong là **local đã có HTTPS tự động** (internal CA/mkcert-style, gắn 4b), **force
redirect HTTP→HTTPS**, **không có chế độ http thuần**. Lý do: **dev-prod parity** — secure
cookie, **passkeys/WebAuthn** (6b.A), **Service Worker/PWA** (4m) đều **đòi HTTPS**; cấm
luôn http xóa lớp bug "chạy http nhưng vỡ trên https". Zero-config: dev không tạo cert tay.

### T2. Hot reload CHỈ ở `develop` — staging/prod là artifact bất biến
**Dev**: HMR + watch + eval cực mạnh (4c). **Staging/Prod**: chạy **single binary đã biên
dịch, bất biến** — **không watch, không eval, không hot reload**. Lý do: **bảo mật** (không
bề mặt inject code ở prod), **hiệu năng**, **reproducibility** (artifact chạy đúng cái đã
test). Env-gated cứng: code hot-reload **không tồn tại** trong build prod (tree-shaken).

### T3. Fault tolerance là mặc định, không phải opt-in
Một lỗi **không bao giờ được cascade**. Bật sẵn: **error boundary per-cell** (một cell hỏng
không sập trang) · timeout/retry/circuit-breaker/bulkhead (4e) · **load shedding** bảo vệ p99
(4f) · graceful shutdown/drain (4d) · **fallback cache/offline** (4m/4f) · worker supervised +
retry/DLQ (6b.B). Triết lý: **degrade gracefully**, luôn có đường lui, không có single point of cascade.

### T4. Không feature nào "xong" nếu thiếu test + doc
**Release gate cứng**: mọi tính năng (code framework) ship kèm **test đầy đủ** *và* **doc rõ
ràng** — không có ngoại lệ. fluxe còn **scaffold test cho code dev** (mock `Backend` cực dễ
vì là interface — gắn review §A) và **sinh doc/API reference từ type** (6f). Test + doc là
**deliverable hạng nhất**, không phải việc làm sau.

### T5. Lỗi là GIÁ TRỊ có kiểu — không bao giờ là bất ngờ, không bao giờ leak
Quy tắc xử lý lỗi (chi tiết cơ chế ở **Trục 4q**):
- **Phân biệt 2 lớp**: **expected (domain)** — NotFound/Unauthorized/Validation/Conflict… là **giá trị
  có kiểu trong contract**, xử lý tường minh; **unexpected (bug/panic)** — **bắt ở biên request**,
  log + report + trace, trả **500 generic + error-ID**, **KHÔNG bao giờ leak stack/nội bộ ra client ở prod**.
- **Một lỗi KHÔNG cascade**: error boundary **per-cell** (gắn T3) — cell hỏng → fallback cell đó, trang vẫn sống.
- **Fail-fast vs fail-soft**: lỗi cấu hình → chặn lúc build/boot (T4); lỗi runtime → degrade mềm (T3).
- **Scrub secret/PII** khỏi mọi message (6b.I/4k); mọi unexpected error gắn `trace_id` (4i) để truy.

> Năm tenet này + **RCA** + **escape-hatch 3 tầng** = 7 luật nền. Mọi trục bên dưới phải
> tuân. Đây là "hiến pháp" của fluxe — thứ giữ cho all-in-one không trôi thành hỗn loạn.

---

## 0. Điểm khác biệt cốt lõi (USP) — đã chứng minh chạy thật

fluxe nắm 3 thứ mà các framework top **không** có cùng lúc:

1. **Biên `Backend` polyglot** — loader/action chỉ gọi interface `Backend`
   (`listTodos/addTodo/toggleTodo`), không biết phía sau là gì. Đã chứng minh:
   tráo sang **service Go thật** và **Rust thật** qua HTTP, frontend/cell không
   đổi một dòng (`app/native/`, `src/backends/http.ts`, `run-native.sh`).
2. **Cell model** — `static` = 0 JS, `island` = hydrate. Ship đúng JS cần thiết.
3. **Inertia-style** — server chạy loader → props thẳng vào React, không fetch tay.

→ **Chiến lược:** KHÔNG cố làm "Next.js nhưng tốt hơn" trực diện (sẽ thua hệ sinh
thái). Chọn các **trục mà incumbent không thể đi theo vì bị legacy trói** (đặc biệt
là biên "JS-only server"). Đào sâu vào polyglot.

### Vì sao incumbent kẹt
- **Next**: cưới chặt React + Vercel/Node runtime, RSC phức tạp, không polyglot.
- **Astro**: islands là khái niệm client-side, backend vẫn JS, không có biên ngôn ngữ.
- **Remix**: web-standards tốt nhưng server vẫn 100% JS.

Cả 3 không vượt được biên "JS-only server" — đúng chỗ fluxe đã đi qua được.

---

## 1. Trục leapfrog — thứ làm fluxe "tiên tiến hơn", không chỉ "nhiều feature hơn"

### Trục 1 — Framework là một COMPILER, không phải runtime  ⭐ wow kỹ thuật
Thay vì dev khai báo `static`/`island`/server/client thủ công, fluxe **phân tích
đồ thị phụ thuộc dữ liệu của toàn app lúc build** và tự quyết định cái gì chạy ở đâu:
- Cell chỉ đọc data tĩnh → render server, 0 JS.
- Cell có handler tương tác → chỉ ship đúng phần JS đó.
- Hot-path (search, filter nặng) → tự đẩy xuống Go/Rust service.

Làm được vì fluxe **sở hữu cả contract** giữa các ngôn ngữ → whole-program placement.
Next/Astro không có biên ngôn ngữ + compiler thống nhất nhìn cả 3 ngôn ngữ.

### Trục 2 — Resumability thật, bỏ hydration hoàn toàn
Hydration (kể cả island) vẫn execute JS lúc load. Frontier (Qwik mở đường):
server serialize state + vị trí event listener vào HTML, client **0 JS execute**
tới khi user chạm vào. Hợp triết lý "ít JS" của fluxe, vượt Astro (vẫn hydrate island).

### Trục 3 — Local-first / sync engine tích hợp sẵn  ⭐⭐ bet định vị next-gen
Hướng next-gen thật (Linear, Zero/Rocicorp, ElectricSQL): data sống ở client, sync
nền, UI tức thời, offline-first. Không framework UI top nào tích hợp sẵn.

Lợi thế độc nhất của fluxe: **sync engine viết bằng Rust/Go** (CRDT, reconciliation)
nằm sau biên `Backend`, cell chỉ đọc state local. Combo không ai có:
local-first UX + sync engine hiệu năng cao polyglot.

→ **Nếu chọn MỘT bet để vượt mặt: chọn trục này.** Hướng tương lai, và chỉ fluxe
làm được tự nhiên nhờ kiến trúc polyglot đã chứng minh.

### Trục 4 — Single deployable artifact + edge-native
Vì server có thể là Go/Rust: đóng gói **toàn app (server + assets + sync) thành
1 binary**, deploy = copy 1 file, khởi động <5ms, chạy ở edge. JS framework không
làm sạch được (luôn kéo theo Node/V8). Lợi thế deploy/ops yêu ngay.

---

## 2. Khai thác sâu polyglot backend (đào hào quanh USP)

- **Codegen hợp đồng**: từ 1 schema (Zod / `.fluxe` IDL) sinh ra TS types + Go
  structs + Rust structs + client adapter. Sửa schema một chỗ, 3 ngôn ngữ đồng bộ.
  → "wow moment" câu dev mạnh nhất, dựng được ngay trên code đã có.
- **Type-safe xuyên biên ngôn ngữ**: lỗi compile-time nếu Go service đổi field mà
  cell chưa update. tRPC làm trong JS — fluxe làm **xuyên ngôn ngữ**, mạnh hơn.
- **Transport pluggable**: hiện HTTP/JSON. Thêm gRPC / Connect-RPC / msgpack cho
  hot-path. Interface `Backend` giữ nguyên.

### Wire format zero-copy làm ENGINE ngầm (bề mặt DX không thấy)  ⭐⭐
Theo RCA, **mã hóa wire là driver của trục Transport**: dev viết hợp đồng có kiểu, engine
tự chọn format zero-copy bên dưới. Bề mặt code **không dùng** chúng; **cỗ máy** dùng để
tăng tốc. Codegen (mục 2) đã có schema → chỉ phát thêm accessor zero-copy.

- **Zero-copy = wire format trùng in-memory layout** → đọc field trực tiếp, **không parse,
  không alloc** (thứ JSON không có). Hai ứng viên:
- **FlatBuffers** — *mặc định nội bộ khuyến nghị*. Codegen **TS/Go/Rust đồng đều** (quan
  trọng vì SSR tier là TS phải tham gia), đọc zero-copy, rất chín. Không RPC built-in.
- **Cap'n Proto** — *driver hiệu năng cao cho chặng Go↔Rust* (không có TS trong vòng).
  Vũ khí riêng: **RPC + promise pipelining** — chuỗi gọi A→B→C trong **một** round-trip,
  cực hợp biên `Backend` + service discovery (4e) + QPS (4f). **Điểm yếu: binding TS/JS
  yếu** → đừng đặt nó ở chặng có TS.
- **Phân tầng đề xuất**: JSON ở **biên ngoài** (người/edge/debug) · FlatBuffers ở **chặng
  nội bộ có TS** · Cap'n Proto (hoặc RPC của nó) ở **hot path Go↔Rust thuần**.
- ⚠️ **Thành thật**: zero-copy lợi nhất ở **Go/Rust**, không phải TS (object JS không
  thật zero-copy) → củng cố "đường nóng = compiled". Và **phải đo** (gắn benchmark 4f):
  message nhỏ có thể bị chi phí khác nuốt — chọn theo số, không theo cảm tính.
- Loại khác để biết: **protobuf** (phổ biến, không zero-copy), **rkyv/bincode** (Rust-only,
  rkyv nhanh nhất nhưng không polyglot), **Arrow** (columnar, hợp data/analytics).

### Backend ecosystem mở — Express/Hono/Fastify nay, C++/C#/Java sau (cộng đồng)  ⭐⭐⭐
`Backend` là **hợp đồng trung lập ngôn ngữ/framework** → thêm backend = thêm adapter tuân
spec, **không đụng cell/frontend** (đã chứng minh với Go/Rust qua `run-native.sh`). Backend
chính là **extension point** của 6e + minh chứng cho "bring-your-own-backend" (6c).

- **Điều kiện để mở mà không loạn — Backend Conformance Spec**: bất kỳ ngôn ngữ/framework nào
  muốn làm backend phải (1) nói **wire protocol** (HTTP/JSON mặc định, hoặc FB/capnp), (2) sinh
  **types từ schema** (mục 2), (3) **pass bộ test tuân thủ** (gắn contract testing 6c). Pass =
  tự động được type-safe xuyên ngôn ngữ + tracing (4i). Không pass = không phải backend hợp lệ.
- **Adapter JS chính thức ngay (ecosystem Node)**: **Express** (adopt code API cũ — 6c),
  **Fastify** (perf JS), **Hono** ⭐ (edge-native: Cloudflare Workers/Bun/Deno → **mở rộng tầm
  deploy ra edge JS runtime**). Cùng `createHttpBackend` phía TS + adapter server mỗi framework.
- **Cộng đồng sau: C++ / C# (ASP.NET) / Java (Spring) / Python…** — chỉ cần implement spec +
  pass conformance. Tiering **official** (Go/Rust/Hono/Express/Fastify) vs **community** (kiểu
  Astro integrations) để giữ chất lượng.
- ⚠️ **Thành thật**: adapter JS (Express/Hono/Fastify) là để **tương thích/adoption**, KHÔNG
  cho lợi thế perf của Go/Rust — đường nóng vẫn nên compiled. Và publish **capability matrix**
  mỗi backend (transport nào hỗ trợ: JSON-only hay cả FB/capnp) để kỳ vọng đúng.

> Vì sao mạnh: biến "polyglot" từ 2 ngôn ngữ thành **một spec mở** — Language axis của RCA
> trở thành điểm cộng đồng đóng góp. Mỗi backend mới = thêm sức hút, không thêm phức tạp cho cell.

---

## 3. Đào hào quanh cell model

- **Server cells / partial hydration tự động**: phân tích cell nào cần JS, tự cắt
  bundle. Dev không khai báo `static`/`island` thủ công (liên quan Trục 1).
- **Resumability** thay hydration (Trục 2).
- **Per-cell caching**: ISR / stale-while-revalidate ở mức cell, không phải mức page.

---

## 4. Nền móng bắt buộc — thiếu là bị loại ngay

Dev assume mặc định phải có:

- **File-based routing** + dynamic params (`/todos/[id]`), nested layouts.
- **Data mutations chuẩn**: optimistic update, revalidation, form actions
  (kiểu Remix `action`). Hiện `rpc()` còn thô → cần API mức cao hơn.
- **Streaming SSR** + Suspense (gửi HTML dần, không chờ loader chậm nhất).
- **Error / loading boundaries** per cell.
- **Dev server**: HMR thật cho cell (hiện đang `build:client` thủ công).

---

## 4b. Trục — Webserver tích hợp + Zero-config TLS/SSL  ⭐⭐ dễ deploy nhất ngành

Vì server fluxe là Go/Rust thật (đã có, "Không Nginx, server tự phục vụ"), nhúng
thẳng một **production webserver + automatic HTTPS** vào core. Mục tiêu: dev chạy
`fluxe serve --domain app.com` là có HTTPS hợp lệ, **0 file config, 0 lệnh certbot,
0 Nginx**. Đây là cú "easiest in the industry" mà JS framework không làm sạch được.

### Phải có
- **Automatic HTTPS qua ACME/Let's Encrypt**: tự xin, tự gia hạn, tự lưu cert.
  - Go: dùng **CertMagic / autocert** (cùng lõi với Caddy) — battle-tested.
  - Rust: **rustls + instant-acme / rustls-acme** — không phụ thuộc OpenSSL.
- **On-demand TLS**: cấp cert tức thì theo hostname khi request đầu tiên tới
  (hợp multi-tenant / custom domain của khách — tính năng SaaS bán được tiền).
- **HTTP→HTTPS redirect tự động** + **HSTS** mặc định bật.
- **HTTP/2 và HTTP/3 (QUIC)** sẵn — vượt mặc định của Node-based framework.
- **Static + compression** (gzip/brotli) + cache headers tích hợp, không cần CDN
  để bắt đầu.

### Dev experience (chỗ ăn điểm)
- **Local HTTPS không đau**: tự tạo internal CA + cert cho `*.localhost` /
  `*.test` (kiểu mkcert), `https://app.localhost` chạy ngay, không cảnh báo trình duyệt.
- **Một flag, không YAML**: cấu hình tối thiểu, mặc định an toàn (TLS 1.3, cipher tốt).
- **Reverse-proxy mode tùy chọn**: đứng trước service polyglot khác mà vẫn auto-TLS.

### Vì sao chỉ fluxe làm gọn được
- Đã sở hữu runtime Go/Rust → dùng thẳng thư viện ACME native, gói vào **1 binary**
  (liên kết với Trục 4 single-artifact): copy 1 file lên VPS trống → có HTTPS production.
- Next/Astro/Remix chạy trên Node → vẫn cần Nginx/Caddy/Vercel ở trước để có TLS.
  fluxe **là** luôn lớp đó.

### Định vị marketing
"Deploy fullstack app có HTTPS thật trong 1 lệnh, 0 config, 0 Nginx" — câu chuyện
ops cực mạnh, đặc biệt cho self-host / indie dev / on-prem.

---

## 4c. Trục — Local dev zero-setup, nhanh nhất ngành, HMR + DX đỉnh  ⭐⭐ câu dev trực tiếp

DX lúc dev là thứ dev cảm nhận **mỗi giây**, quyết định họ ở lại hay bỏ đi. Mục tiêu:
`fluxe dev` → app chạy tức thì, sửa code thấy ngay <50ms, **0 cấu hình, 0 cài cắm**.

### Zero-setup (chạy là được, không dựng môi trường)
- **Toolchain 1 binary**: `fluxe` gói sẵn bundler (esbuild đã có) + dev server +
  runner cho service Go/Rust. Không `node_modules` khổng lồ, không lock-file địa ngục.
- **`create-fluxe` → `fluxe dev`** là xong: không cần config webpack/vite/tsconfig tay.
- **Mặc định thông minh**: routing, TLS local (Trục 4b), backend memory — chạy ngay,
  cấu hình sau khi cần.

### Nhanh nhất ngành (đây là tuyên ngôn, phải đo được)
- **Cold start tức thì**: server Go/Rust khởi động <5ms + esbuild bundle ms-level →
  từ lệnh tới trang chạy nhanh hơn hẳn stack Node nặng.
- **Incremental rebuild theo cell**: chỉ build lại cell đổi, không build cả app.
- **No-bundle dev tùy chọn**: serve ESM thẳng cho dev (kiểu Vite), bundle chỉ khi build.

### Hot reload thật cho CẢ polyglot (điểm khác biệt)
- **HMR giữ state**: sửa view cell → swap module, **không mất `useState`**, không reload trang.
- **Hot reload xuyên ngôn ngữ**: sửa service Go/Rust → tự recompile + restart service
  (kiểu `air` cho Go, `watchexec` cho Rust), client tự reconnect. Một `fluxe dev`
  trông coi **frontend + mọi backend polyglot** cùng lúc — không phải mở 3 terminal.
- **Contract hot reload**: đổi schema (mục 2) → regenerate types TS/Go/Rust tức thì,
  lỗi lệch hợp đồng hiện ngay trong overlay.

### DX feedback tức thì
- **Error overlay** đẹp: lỗi runtime + type error + lỗi compile Go/Rust hiện ngay
  trên trình duyệt, click tới đúng dòng.
- **Type-check nền**: chạy song song, không chặn HMR.
- **Request/RPC inspector**: thấy loader/action/`rpc()` chạy gì, backend nào trả về.

### Vì sao fluxe làm được mà incumbent khó
- Sở hữu runtime Go/Rust → một dev orchestrator duy nhất điều phối được cả bundler JS
  lẫn watcher/recompiler cho service biên dịch — không stack JS nào quản lý hot reload
  cho backend Rust/Go giùm bạn. Đây là DX "một lệnh trông coi cả polyglot".

> Liên kết: chuẩn hóa thành công cụ ở **mục 6 (DX & cộng đồng)** — `create-fluxe`,
> templates, playground.

---

## 4d. Trục — Scale-out đa node dễ dàng + thân thiện cloud/K8s  ⭐⭐

Mục tiêu: từ 1 node lên N node chỉ là tăng replica, không phải viết lại. Biên `Backend`
+ single-binary giúp fluxe **hợp scale ngang hơn** stack Node — nhưng "dễ" chỉ thật nếu
thiết kế **stateless + externalize state từ ngày đầu**. Đây là lợi thế lẫn ràng buộc.

### Vì sao kiến trúc fluxe sẵn sàng scale ngang
- **Tách tầng tự nhiên**: SSR/cell tier và service Go/Rust nằm hai phía biên `Backend`
  → **scale độc lập**. Trang nặng render thì thêm node SSR; backend nặng tính toán thì
  thêm node service. Không bị "một process gánh tất cả" như Node monolith.
- **Single binary = đơn vị scale lý tưởng**: image container nhỏ, cold start <5ms →
  hợp **HPA / autoscale / scale-to-zero**, rollout nhanh, blue-green/canary rẻ.
- **Stateless app node**: SSR + loader/action không giữ state cục bộ → bỏ sau load
  balancer, thêm/bớt node tùy ý, không sticky session.

### Cái PHẢI làm để scale-out thật sự dễ (đừng oversell)
- **Externalize toàn bộ state**: session/cache/queue ra store dùng chung (Redis/NATS/
  Postgres). App node tuyệt đối stateless.
- **Realtime/sync engine (Trục 3) phải distributed**: fan-out qua pub/sub (NATS/Redis
  Streams) để client nối node A nhận update từ node B. Đây là phần khó nhất — thiết kế
  sớm. Lõi Rust/Go làm coordinator rất hợp.
- **Durable jobs (6b.B) phải có distributed queue + leader election/locking** để N node
  không chạy trùng cron/job.
- **Auto-TLS đa node (Trục 4b)**: cert store **dùng chung** (CertMagic hỗ trợ storage
  phân tán) để mọi node share cert, tránh mỗi node tự xin → đụng rate-limit Let's Encrypt.

### Thân thiện cloud top & Kubernetes (12-factor mặc định)
- **Health/readiness/liveness probe** + **graceful shutdown** (drain connection) sẵn —
  bắt buộc cho rolling update K8s.
- **Config qua env** (12-factor), không file cứng; secrets từ env/secret manager.
- **Observability chuẩn**: OpenTelemetry trace/metric + structured log (JSON) ra stdout
  → cắm thẳng Datadog/Grafana/Cloud Logging, không cần lắp.
- **Container-first**: image distroless tối thiểu (binary + assets), không Node runtime
  → nhỏ, ít CVE, pull nhanh.
- **Adapter cloud top**: Dockerfile/Helm chart/Terraform module mẫu cho AWS/GCP/Azure;
  chạy được cả serverless container (Cloud Run / Fargate / ACA) lẫn K8s.
- **Stateless-friendly với edge** (Trục 4): node đặt nhiều region, state ở store gần nhất.

### Định vị
"Một binary, thêm replica là scale; K8s-native, observability sẵn, hosting rẻ" — thông
điệp platform/ops mạnh. Đối thủ Node phải lắp Nginx + process manager + sidecar mới đạt.

---

## 4e. Trục — Service discovery + microservice đơn giản hóa cho mọi người  ⭐⭐⭐

Biên `Backend` **đã là một ranh giới service** (đã chứng minh: cell gọi service Go/Rust
qua HTTP, không biết nó ở đâu). Tận dụng điều này để mang microservice tới mọi dev mà
**không kèm độ phức tạp thường thấy**: tách hay gộp service chỉ là đổi config.

### Monolith ↔ microservice là một "config flip" (ý tưởng lõi)
- **Cùng codebase, cùng contract**: dev viết service theo interface `Backend` (TS/Go/Rust).
- Chạy **modular monolith** (mọi service in-process, 1 binary — dev & app nhỏ) HOẶC
  **phân tán** (mỗi service một deployment) — **chỉ đổi config**, không sửa cell/frontend.
- → "Bắt đầu monolith, tách service khi cần" mà không phải rewrite. Đây là điều
  microservice hứa nhưng hiếm khi dễ; biên `Backend` của fluxe làm nó thật.

### Service discovery tích hợp, đa môi trường
- **Registry trừu tượng**: cell/loader gọi service theo **tên logic** (`orders`,
  `search`), runtime resolve ra địa chỉ thật. Không hardcode URL.
- **Adapter theo môi trường, không đổi code**:
  - Local: in-process / mDNS / file config (gắn `fluxe dev`, Trục 4c).
  - K8s: **DNS của K8s Service / headless service**, readiness-gated.
  - Cloud: Consul / etcd / Cloud Map; hoặc env-injected.
- **Self-registration + health**: service tự đăng ký, discovery loại node unhealthy
  (gắn health probe Trục 4d).

### Resilience native ở tầng adapter (microservice an toàn mặc định)
- **Client-side load balancing** giữa các instance của một service.
- **Timeout, retry (idempotent), circuit breaker, bulkhead** bật sẵn — khỏi lắp tay.
- **mTLS giữa các service** tự động (gắn auto-TLS Trục 4b) — zero-trust nội bộ, không
  cần service mesh nặng; tùy chọn tích hợp mesh (Istio/Linkerd) nếu muốn.
- **Backpressure + deadline propagation** xuyên chuỗi gọi.

### Thân thiện K8s & cloud
- Mỗi service map thẳng tới **K8s Service/Deployment**, scale riêng bằng replica/HPA.
- Discovery dùng cơ chế native của nền tảng (K8s DNS, Cloud Map) → không cần hạ tầng
  discovery riêng để bắt đầu.
- Helm chart / Terraform mẫu mô tả nhiều service + wiring (gắn Trục 4d).

### Vì sao tiên tiến hơn
Microservice trong thế giới Node thường = tự ráp gateway + discovery + retry + mTLS +
tracing, dễ sai. fluxe gói tất cả sau **một biên `Backend` thống nhất**, polyglot, với
mặc định an toàn — **đưa kiến trúc phân tán "cấp doanh nghiệp" về mức một dev cũng dùng được.**

---

## 4f. Trục — Throughput RPS/QPS top ngành (trừ DB bottleneck)  ⭐⭐

Mục tiêu: đạt RPS/QPS + p99 latency thuộc nhóm dẫn đầu (đối chiếu TechEmpower-style),
**không tính DB** vì đó là điểm nghẽn chung mọi framework. fluxe có lợi thế gốc: hot
path chạy **Go/Rust biên dịch**, không kẹt ở event loop Node đơn luồng. Việc còn lại
là kỹ thuật để không phí lợi thế đó.

### TODO — Hot path & runtime
- [ ] Đẩy **hot path xuống Go/Rust** (qua biên `Backend`); giữ Node khỏi đường nóng.
- [ ] **Async runtime hiệu quả**: tokio (Rust) / goroutine pool (Go), tránh tạo task thừa.
- [ ] **Zero-/low-allocation trên request path**: object pooling, arena/buffer reuse,
      tránh alloc trong middleware chain (mục 6b.F) mỗi request.
- [ ] **Router radix-tree precompiled**, match O(k) theo độ dài path, không regex/loop.
- [ ] **Load shedding + backpressure**: bảo vệ p99 khi quá tải, ổn định hơn là sập tail.

### TODO — Serialization & transport
- [ ] **Serializer nhanh**: SIMD JSON (sonic/simd-json) hoặc **msgpack/protobuf** cho
      RPC nội bộ; JSON chỉ ở biên ngoài.
- [ ] **Binary transport giữa SSR ↔ backend** (gRPC/Connect) — gắn "transport pluggable"
      (mục 2), cắt overhead JSON ở chặng nội bộ QPS cao.
- [ ] **HTTP/2 + HTTP/3 (QUIC)**, keep-alive, connection pooling, multiplexing.
- [ ] **Brotli/gzip precompressed** cho static, không nén lại mỗi request.

### Kiến trúc render TSX tân tiến — nhanh hơn mà VẪN tương thích lib React
> Đánh đổi nền tảng: hiệu năng render đỉnh (Solid/Qwik/Vue Vapor) đến từ **bỏ vdom +
> fine-grained signals** — nhưng cái đó **phá tương thích runtime React**. Để giữ hệ
> sinh thái React, dùng 3 nhóm dưới (A+C là lựa chọn cho fluxe).

- [ ] **(A) React Compiler (Forget) bật mặc định** ⭐ — auto-memoization lúc build, loại
      re-render thừa, bỏ `useMemo/useCallback` tay. Vẫn React thuần → mọi lib chạy nguyên.
- [ ] **(A) Block-vdom kiểu Million.js** — compiler biến JSX thành "block", diff theo
      block thay vì cả cây; drop-in với component React, thắng lớn ở list/table nặng.
- [ ] **(A) Streaming SSR** (`renderToPipeableStream`) thay `renderToString` — không block.
- [ ] **(A) SSR component/micro cache** — cache HTML render theo key props; row/card lặp
      không render lại. Tương thích mọi component.
- [ ] **(B) Preact + preact/compat** tùy chọn cho cell `island` — API React, ~3KB, nhanh
      hơn; cảnh báo vài lib lệch edge.
- [ ] **(C) Lai theo cell — đòn bẩy mạnh nhất, hợp sẵn fluxe** ⭐⭐⭐:
      cell `static` → **compile JSX → chuỗi HTML lúc build / cache, KHÔNG ship React
      runtime (0 JS)**; cell `island` → **React đầy đủ** (React Compiler + streaming) giữ
      trọn hệ sinh thái đúng chỗ cần tương tác. → không phải chọn một engine cho cả app.
- [ ] **(C) Renderer pluggable theo cell**: contract là TSX; cho cell hot chọn renderer
      nhẹ, cell ecosystem-heavy giữ React — cùng một cú pháp JSX.

### SPA + SSR + CSR + SSG — hỗ trợ HẾT, nhưng giải per-cell (không flag toàn cục)
> Đây là trục **Render × Location** của RCA. fluxe không có "chế độ render"; mỗi cell
> được **giải** ra strategy hợp nhất. Phần lớn mảnh **đã có sẵn** trong code.

| Mode | Cách giải | Trạng thái |
|------|-----------|-----------|
| **SSG/static** | cell `static` → HTML lúc build, 0 JS, từ edge/cache | ✅ đã có |
| **SSR** | loader server → `renderToString`/streaming | ✅ đã có |
| **Island** | chỉ phần tương tác hydrate | ✅ đã có |
| **SPA nav** | `x-fluxe:1`/`?json=1` trả props JSON → swap client, no reload (Inertia) | ✅ cơ chế đã có |
| **CSR thuần** | cell giải `location: client` (app-shell sau auth) | 〽️ chỉ là 1 resolution |
| **Resumable** | thay hydration, 0 JS execute tới khi chạm (Trục 2) | ➡️ frontier |

**Default TỐI ƯU hiện nay (hybrid, không chọn một):**
1. First paint: **SSG** nếu tĩnh được → nếu không, **streaming SSR** (HTML tới ngay).
2. Hydration: chỉ **island** (hoặc **resumable**) phần tương tác; phần tĩnh 0 JS.
3. Điều hướng sau: **SPA-style** — fetch props JSON, swap client, no reload (+ View Transitions).
4. **CSR thuần** chỉ cho cell sau auth/dashboard (SEO + first-paint không quan trọng).

→ SSR/SSG cho lần đầu (nhanh + SEO) · SPA cho lần sau (tức thì) · island/resumable cho JS
tối thiểu. Tránh cả SPA-thuần (chậm first-paint, kém SEO) lẫn SSR-thuần (điều hướng nặng).
**Khác biệt:** trộn cả 4 trong **một app, quyết định per-cell**, dev không viết khác nhau —
chỉ là giá trị giải trục Render/Location. Next phải tách Pages/App router + nhiều config.

### TODO — Render & cache (cắt việc lặp lại)
- [ ] **Streaming SSR** (Trục 2) — không block ở `renderToString`, trả HTML dần.
- [ ] **Per-cell cache** + **stale-while-revalidate** (mục 3): cell `static` phục vụ từ
      memory/edge, gần như free; cell `island` cache phần render được.
- [ ] **Component/fragment cache** + ETag/conditional request (304) cho tài nguyên lặp.
- [ ] **Asset immutable + content-hash** → cache vĩnh viễn ở browser/CDN.
- [ ] **Request coalescing / singleflight**: gộp request giống hệt đang bay làm một,
      tránh thundering-herd lên backend/cache.

### TODO — Đo & chứng minh (không tự nhận, phải có số)
- [ ] **Benchmark harness** kiểu TechEmpower: plaintext, JSON, fortunes (in-memory) —
      công bố RPS/p50/p99 so với Next/Remix/Fastify; **loại DB** để đo đúng framework.
- [ ] **Load test trong CI** (k6/vegeta) chặn regression hiệu năng theo PR.
- [ ] **Profiling sẵn** (pprof Go / flamegraph Rust) để tìm hot spot.
- [ ] **Đo theo lõi**: RPS/core và RAM/req — gắn định vị chi phí (mục 6b.E "hóa đơn 1/N").

> Lưu ý: lợi thế hiệu năng chỉ thật nếu **không tự bóp nghẹt ở tầng JS/SSR**. Nguyên tắc:
> đường nóng = compiled + cached + binary transport; JS chỉ làm phần tương tác.

### Profiling native — cross-language + continuous + Profile-Guided Resolution  ⭐⭐⭐
Bộ profiling "tốt nhất" cho fluxe = đo được **xuyên TS↔Go↔Rust**, chạy được **liên tục ở prod**
chi phí thấp, và **feed ngược cho Resolver** (điểm độc nhất). Cùng cluster quan sát với
tracing (4i) / dashboard (4j) / debug bar (4l).

- **On-demand**: `fx profile` chộp **CPU / heap / alloc / goroutine-async / lock-contention**
  của instance đang chạy. Lõi: **pprof (Go)** · **pprof-rs/flamegraph (Rust)** · CPU profile (Node/V8).
- **Format chuẩn pprof** → mở bằng `go tool pprof` / speedscope / Grafana; không lock-in.
- **★ Cross-language flamegraph hợp nhất**: vì polyglot, ghép CPU/alloc **xuyên một request
  TS→Go→Rust thành MỘT flamegraph** (như trace 4i hợp nhất) — không stack nào làm được tự nhiên.
- **Continuous profiling ở prod** (always-on, overhead thấp): tích hợp **Pyroscope / Parca /
  Polar Signals** (eBPF) — thấy hot spot thật trên tải thật, không chỉ lúc benchmark.
- **In-page**: flamegraph per-request ngay trong **debug bar (4l)**; tổng hợp ở **dashboard (4j)**.
- **★ Profile-Guided Resolution (PGR) — nối thẳng RCA**: dữ liệu profiling **feed ngược
  Resolver** → cell/đoạn nóng tự được **đề xuất giải sang Rust/Go** hoặc cache (gắn Trục 1).
  Profiling không chỉ để xem — nó **đóng vòng lặp tối ưu placement**. (Sau v0.1 — manifest là
  điểm cắm tự nhiên: Resolver đọc profile data như một input của ma trận giải.)
- ⚠️ Overhead: sampling + opt-in mức nặng; scrub PII khỏi label (gắn 4i).

---

## 4g. Trục — Realtime native: WebSocket + SSE + Polling + Channel (DX dễ nhất ngành)  ⭐⭐⭐

Hiện `rpc()` lo **request-response**. Bổ sung lớp **server push 2 chiều** hạng nhất để fluxe
làm được chat, live dashboard, notification, collab, AI token stream — không phải lắp
Socket.io/Pusher tay. Lõi fan-out viết **Go/Rust** (chịu hàng vạn kết nối rẻ).

### ★ DX dễ nhất ngành — MỘT primitive, transport tự thương lượng (RCA Transport axis)
Tuyên ngôn: **dev không bao giờ chọn WS/SSE/polling.** Viết một thứ, chạy mọi nơi.
- **Client**: `const msgs = useChannel("room:42")` → dữ liệu reactive tự cập nhật; gửi 2 chiều
  bằng `channel.push(...)`. **Server**: `channel("room:42").broadcast(...)`. Hết — không config transport.
- **Transport late-bound, auto-negotiate**: **WebSocket** (2 chiều) → **SSE** (server→client,
  qua proxy/CDN tốt) → **Polling/long-poll** (mạng/proxy chặn WS-SSE). Client dò khả năng,
  **tự hạ cấp + tự reconnect + resume (replay event lỡ)** — dev không thấy sự khác biệt.
- **Polling là tầng chính thức, không phải chắp vá**: long-poll + **adaptive interval** +
  conditional request (ETag/304) → rẻ, chạy được ở môi trường ngặt nghèo (corporate proxy, serverless).
- **Type-safe + optimistic mặc định**: payload sinh type từ contract (mục 2); gửi đi update
  UI lạc quan, tự rollback nếu fail — không viết tay.
- **Cùng API ở dev và prod**: dev in-memory 0 hạ tầng; prod NATS fan-out — code không đổi (RCA).

> So đối thủ: Socket.io chỉ WS/poll (không SSE chuẩn), không type-safe, không distributed sẵn;
> Pusher/Ably là SaaS trả tiền. fluxe: **một primitive type-safe, tự chọn transport, distributed,
> chạy local 0-config** — đó là "dễ nhất ngành".

### Channel abstraction (kiểu Phoenix Channels / ActionCable) — API thống nhất
- **Khái niệm `channel` cạnh cell**: subscribe theo **topic** (`room:42`, `user:7`),
  `broadcast`, nhận event push — dev không động tới chi tiết transport.
- **SSE first-class cho streaming một chiều**: AI token stream (gắn 6b.C) và live
  feed dùng SSE — nhẹ, qua được proxy/CDN, gắn Streaming SSR (Trục 2).
- **Type-safe message từ contract** (mục 2): payload channel sinh type TS/Go/Rust,
  không gửi `any`.

### Tích hợp đúng kiến trúc fluxe
- **Island cell tiêu thụ channel**: cell `island` subscribe → UI cập nhật realtime;
  cell `static` không đụng tới (giữ 0 JS).
- **Authz lúc join**: dùng guard + RBAC/ABAC (6b.F) kiểm soát ai vào topic nào.
- **Presence**: theo dõi ai đang online/đang xem (gắn collab, mục 6c).
- **Nền của sync engine** (Trục 3): channel là lớp transport cho local-first sync.

### Distributed-ready từ đầu (bắt buộc, gắn Trục 4d)
- **Fan-out đa node qua pub/sub** (NATS/Redis): client nối node A nhận broadcast từ
  node B. Đây là phần khó — thiết kế phân tán ngay, đừng để state kết nối cục bộ.
- **Backpressure + rate-limit** trên kênh (gắn 6b.F) chống client chậm/lụt.
- **Graceful drain** kết nối khi rolling update (gắn 4d).

> Vì sao đáng làm: realtime là tính năng dev hay phải tự ghép và dễ sai (scale WS, auth,
> fan-out đa node). fluxe gói sau một API `channel` thống nhất, lõi Go/Rust, distributed
> mặc định — biến realtime "khó" thành khai báo cạnh cell.

---

## 4h. Trục — CLI / tooling engine (kiểu `artisan` nhưng gọn & dễ nhớ hơn)  ⭐⭐⭐

Framework mạnh cần **một cửa vận hành thống nhất**. `artisan`/`rails` chứng minh giá trị,
nhưng fluxe nhắm **gọn hơn, dễ nhớ hơn, polyglot-aware**. Một binary `fluxe` (alias `fx`)
lo từ scaffold → migrate → chạy job → quản service → deploy.

### Vì sao tốt hơn artisan (không chỉ "có cho bằng")
- **Ngữ pháp nhất quán, đoán được**: `fx <nhóm> <hành động>` đồng nhất toàn bộ
  (`fx cell new`, `fx job work`, `fx svc list`) → học 1 lần, suy ra phần còn lại,
  không phải nhớ trăm lệnh rời.
- **Tự khám phá**: gõ `fx` ra danh sách nhóm; `fx <nhóm>` ra lệnh con; **fuzzy match +
  tab-completion + gợi ý "ý bạn là…"**. Discoverability thay cho trí nhớ — đây là điểm
  vượt artisan.
- **Mặc định thông minh, ít gõ**: alias ngắn, 0 boilerplate, hỏi tương tác khi thiếu
  tham số; nhưng **scriptable + `--json`** cho CI.
- **Self-documenting**: help đẹp, ví dụ kèm theo, link tới doc — không phải tra ngoài.

### Cái CLI phải làm (gắn các trục)
- **Scaffold/generator**: `fx cell new`, `fx backend new --lang go|rust|ts` (sinh stub
  service đúng contract — mục 2), `fx channel new` (4g), `fx job new` (6b.B),
  `fx migrate make/up/down`, `fx auth setup` (6b.A).
- **Codegen contract**: `fx gen` — 1 schema → types TS/Go/Rust + adapter (mục 2).
- **Vận hành**: `fx dev` (Trục 4c), `fx build`, `fx serve`, `fx job work`, `fx queue`,
  `fx svc list/scale` (4e), `fx routes`, `fx deploy`.
- **Console/REPL**: `fx console` — tương tác trực tiếp với backend qua interface `Backend`
  (kiểu `rails console`/`tinker`), thử loader/action/rpc ngay.
- **`fx doctor`**: chẩn đoán cấu hình/driver/kết nối, gợi ý sửa — giảm support.
- **Plugin command**: WASM plugin (mục 6c) tự đăng ký lệnh `fx` của nó → CLI mở rộng được.

### Định vị
"Một lệnh `fx` lo cả vòng đời app, học 1 lần suy ra hết" — DX vận hành mà dev nhớ và
truyền miệng. Gắn `create-fluxe` (mục 6) làm cửa vào: `npx create-fluxe` → `fx dev`.

---

## 4i. Trục — Distributed tracing native, FE → BE → polyglot  ⭐⭐

Một trace duy nhất chạy suốt: **browser → SSR → loader/action → `rpc()` → biên `Backend`
→ service Go/Rust → DB/cache/queue/channel**. "Native" = bật sẵn, auto-instrument, 0 code
dev — không bolt-on. fluxe làm được vì **sở hữu mọi biên** để cắm span tự động.

### Vì sao chỉ fluxe làm end-to-end *xuyên ngôn ngữ* được (điểm độc nhất)
Incumbent thường cho tracing FE **hoặc** BE; qua biên **TS→Go→Rust** là **đứt trace**.
fluxe **propagate W3C Trace Context (`traceparent`)** qua đúng trục **Transport** (HTTP
header / gRPC metadata / **NATS header** / in-process) → cùng một `trace_id` xuyên cả 3
ngôn ngữ. Đây là hệ quả trực tiếp của việc sở hữu contract boundary.

### Auto-instrument tại các seam fluxe sở hữu (dev không viết gì)
- **BE**: cell render · loader · action · `rpc()` · mỗi lời gọi `Backend` · driver
  (queue/cache/db/storage/pubsub) · channel/SSE (4g).
- **Xuyên service**: span con tự nối khi qua Go/Rust service (4e) — thấy cả chuỗi RPC.
- **Async cũng được trace**: job (6b.B) và pub/sub (6b.G) mang `traceparent` trong NATS
  header → dùng **span links** nối producer↔consumer; không mất dấu ở fan-out.
- **FE**: page load · hydration · `rpc()` · SPA navigation · Web Vitals — span FE là con
  của trace SSR (lấy `traceparent` nhúng lúc render) → **RUM nối thẳng vào trace backend**.

### Tích hợp & vận hành
- **Chuẩn OpenTelemetry, không lock-in**: export ra Jaeger/Tempo/Datadog/Honeycomb tùy ý.
- **Trace ↔ log ↔ metric tương quan**: structured log mang `trace_id` (exemplars) — gắn
  observability 4d.
- **Baggage**: mang `tenant_id`/`user_id` xuyên suốt (gắn multi-tenancy 6c, authz 6b.F).
- **Tail-based + error-biased sampling**: giữ chi phí thấp mà không mất trace lỗi.
- **DX dev**: `fx` hiện **trace waterfall ngay trong dev** (mở rộng RPC inspector 4c) —
  thấy đường đi + thời gian từng hop tại chỗ.

> ⚠️ Thành thật: tracing có overhead → **sampling** bắt buộc; **scrub PII** khỏi span;
> FE tracing thêm JS → giữ tối thiểu, chỉ ở island cell. Mặc định an toàn, opt-in phần nặng.

---

## 4j. Trục — Admin & Monitoring dashboard mặc định (UI impact ngay khi cài)  ⭐⭐⭐

Cài xong → mở `fx dev` đã có sẵn **một dashboard đẹp, dùng được ngay**, 0 cấu hình. Ấn
tượng đầu tiên bán cả framework (kiểu Laravel Pulse/Telescope/Nova, Supabase/Convex Studio).
fluxe làm tốt hơn vì **sở hữu mọi seam** → dashboard tự có dữ liệu thật, không cần dev gắn.

### Dogfood — bản thân dashboard viết bằng fluxe cells
Dashboard = một app fluxe (cell + `Backend` + realtime) → **vừa demo sống vừa là bằng chứng
"framework đủ mạnh để tự dựng tool của nó"**. Bug ở dashboard = bug khung lộ ra sớm.

### Panel có sẵn (vì fluxe sở hữu dữ liệu, không phải cắm thủ công)
- **★ RCA Resolution view (panel chữ ký, không ai có)**: mỗi cell hiện cách **giải 6 trục**
  (Language · Location · Transport · Render · Driver · Scale) — nhìn ra ngay app đang chạy thế nào.
- **Live trace/RPC waterfall** (4i): từng request FE→BE→Go/Rust, thời gian mỗi hop.
- **Cells & routes map**: render mode static/island, bundle size, badge **0-JS**.
- **Services topology** (4e): node Go/Rust/TS, health, driver nào được resolve.
- **Metrics** (4f): RPS/QPS, p50/p99, RAM/req — realtime.
- **Realtime channels** (4g): kết nối/topic/presence đang hoạt động.
- **Jobs & queues** (6b.B): pending/running/failed, retry, DLQ — bấm retry.
- **Database** (6b.H): query log, slow query, trạng thái migration, mở **Studio**.
- **Cache & sketches**: hit-rate, HLL/TopK realtime (6b.G).
- **Auth & audit** (6b.F): users/sessions/roles, **audit log** authz pass/deny.
- **Drivers & backbone**: trạng thái queue/cache/storage/pubsub/NATS/etcd.
- **Logs stream** tương quan `trace_id`; **feature flags & tenant** (6c).

### UI "vô cùng impact" (đây là yêu cầu — phải làm thật)
- **Thiết kế có chủ đích, không templated**: bản sắc riêng, không đụng hàng Bootstrap-admin.
- **Realtime mặc định** (qua Channel 4g): số liệu nhảy sống, không phải bấm refresh.
- **Dark/light, đẹp, nhanh** — bản thân nó chạy island cell, không nặng.
- **Command palette** (⌘K) đi tới mọi panel; gắn `fx` CLI (4h).

### An toàn
- **Dev: bật sẵn** ở `/_fluxe`. **Prod: sau auth + RBAC** (6b.F), hoặc tắt được hẳn.
- Scrub PII (gắn 4i); chỉ role admin thấy panel nhạy cảm.

> Vì sao đáng ⭐⭐⭐: đây là **demo "killer" 30s** (mục 6) ở dạng có sẵn — dev cài thử,
> thấy ngay RCA + polyglot + realtime + tracing **bằng mắt**, không cần đọc docs.

---

## 4k. Trục — Quản lý env/config & secrets tiên tiến (DX + CI/CD + cloud)  ⭐⭐

`process.env` trần là nguồn lỗi prod (thiếu biến, sai kiểu) và footgun bảo mật (lộ secret
ra client). fluxe nâng env thành **contract có kiểu, validate fail-fast, nguồn secret tráo
được qua driver** — đúng RCA: env schema = Contract Plane, secret source = Resolution Plane.

### Env là contract có kiểu (DX cốt lõi)
- **`defineEnv` schema (Zod)**: một nguồn sự thật, **validate lúc build + boot, fail-fast**
  — thiếu/sai biến là chặn trước khi deploy, không chết giữa prod (kiểu t3-env/envalid native).
- **Truy cập type-safe**: `env.DATABASE_URL` có autocomplete + kiểu; **`.env.example` tự sinh** từ schema.
- **Polyglot**: env contract codegen sang Go/Rust → **env type-safe xuyên ngôn ngữ**, service nào cũng dùng chung.

### ★ Tách public vs secret — compiler cưỡng chế (an toàn thật, không phải quy ước)
- Đánh dấu biến **public** (ship được ra FE) vs **secret** (chỉ server). **Compiler chặn**:
  nếu cell client/island chạm secret → **lỗi build**, secret **không thể** lọt vào client bundle.
  Tận dụng việc biết Location của cell (Trục 1) — sửa đúng footgun `NEXT_PUBLIC_` của Next.

### Nguồn secret = driver (local dev → cloud scale, đổi config không đổi code)
- **Driver**: `.env` (dev) · **SOPS/dotenvx** (env mã hóa commit được) · **Doppler/Infisical**
  (Infisical self-host được) · **Vault** · **AWS/GCP/Azure Secret Manager** · **K8s External
  Secrets / CSI**. Đổi nguồn = đổi config (đúng trục State driver RCA).
- **Secrets không bao giờ nằm trần trong repo**.

### CI/CD & cloud (qua `fx env`)
- `fx env validate` (chặn deploy nếu lệch schema) · `pull/push` (đồng bộ secret manager) ·
  `diff` (so giữa dev/staging/prod) · per-environment (dev/staging/prod/**preview** — gắn 6c).
- **Cloud-native**: External Secrets Operator / cloud manager bơm vào lúc chạy; 12-factor mặc định.

### An toàn vận hành
- **Redact secret** trong log/trace (gắn 4i) và dashboard (4j) — không lộ giá trị.
- Rotation: đổi secret ở manager → service nhận qua driver, không rebuild.

> Vì sao khớp fluxe: cùng khuôn "interface + driver + in-memory dev → cloud scale".
> Local `.env` chạy ngay 0 hạ tầng; prod giải xuống Vault/cloud — **Contract Plane (env
> schema) không đổi một dòng**.

---

## 4l. Trục — Debug bar / profiler in-page (kiểu Laravel Debugbar, nhưng mạnh hơn)  ⭐⭐⭐

Thanh debug nổi trong trang lúc dev: **thấy MỌI hoạt động của framework cho TỪNG request**,
0 cấu hình. Khác dashboard (4j = ops tổng thể) — đây là **per-request, ngay trong trang**.
Dùng chung dữ liệu với tracing (4i) nên nhất quán dev↔prod, không phải cơ chế riêng.

### Thấy gì cho mỗi request (vì fluxe sở hữu mọi seam)
- **Timeline/waterfall**: SSR render · từng **loader/action** · từng lời gọi **`Backend`** ·
  query DB · cache hit/miss · `rpc()` · event channel — kèm thời gian từng bước.
- **Query DB** (6b.H): số lượng, SQL + bindings + duration, **cảnh báo N+1**, slow query.
- **Backend calls**: backend nào (Go/Rust/TS), transport, kích thước payload, latency → link
  thẳng **cross-language trace** (4i).
- **RCA resolution của request này**: mỗi cell giải trục nào (language/location/render/driver).
- **Render/JS**: thời gian render, chi phí hydration, **bao nhiêu JS ship cho island**.
- **Auth/authz** (6b.F): user, guard nào chạy, quyết định RBAC/ABAC pass/deny.
- **Logs** phát trong request (kèm `trace_id`), **jobs dispatch**, **event publish**.
- **Request/response**: headers, params, input đã validate, cookie — **secret bị redact** (4k/6b.I).
- **Exception**: stack + source map, **click tới đúng dòng trong editor** (gắn LSP 6f).

### Mạnh hơn Debugbar/Rails ở đâu
- **Xuyên ngôn ngữ**: thấy cả hop **Go/Rust** inline (Debugbar chỉ thấy PHP).
- **SPA + rpc aware**: bắt cả **điều hướng SPA và `rpc()`**, không chỉ full page load (Debugbar mù SPA).
- **Ba bề mặt một nguồn**: cùng dữ liệu hiện ở **in-page bar · dashboard (4j) · editor (6f)**.

### DX & an toàn
- **Bật sẵn ở dev**, đẹp, overhead thấp (chỉ dev/sampled); **prod: tắt / sau auth**.
- Click một dòng → nhảy tới code (6f) hoặc mở full trace (4i).

> Vì sao ⭐⭐⭐: "thấy mọi thứ framework đang làm" là DX gây nghiện (lý do dev yêu Laravel/Rails).
> fluxe cho bản **xuyên polyglot + SPA-aware**, dùng lại trace có sẵn — không phải tool dev-only rời.

---

## 4m. Trục — Service Worker native (PWA / offline / push) auto-generated  ⭐⭐

Service Worker là "edge ở phía client". fluxe biến nó từ **footgun viết tay** (cache cũ,
version kẹt, khó debug) thành **tự sinh từ cell graph** — dev bật `pwa: true` là có, vẫn
override sâu được (escape-hatch 3 tầng).

### ★ Auto-generate từ Resolution Plane (điểm fluxe-native)
Engine biết mỗi cell giải **render** gì (static/island) + asset nào → tự sinh SW với
**precache manifest + chiến lược cache đúng per-cell**, tự lo **versioning/cleanup/skip-waiting**.
Dev không viết SW tay; muốn thì **eject + sửa** (Tier 2, gắn nguyên tắc escape-hatch).

### Áp được gì cho fluxe (gắn các trục sẵn có)
- **Offline / PWA**: precache **app shell + cell `static` (0 JS)** → mở được khi offline; installable.
- **SPA nav tức thì + offline**: cache **props JSON** của route đã thăm (Inertia model) →
  điều hướng instant, chạy cả khi mất mạng; stale-while-revalidate ở tầng SW (bổ trợ cache 4f).
- **★ Background Sync — offline writes**: `rpc()`/action lúc offline được **xếp hàng trong SW**,
  **tự replay khi online lại** → nền cho **local-first** (Trục 3). Đây là giá trị lớn nhất.
- **Web Push (kể cả tab đóng)**: SW nhận push → kênh **push của notification** (6b.J) + nối
  **realtime resume** (4g) khi mở lại.
- **Periodic background sync**: làm mới dữ liệu nền.
- **Edge-ở-client (RCA Location mở rộng)**: một phần resolution chạy ngay trong SW — ghép
  cached + live, giảm round-trip.

### DX & an toàn
- **`pwa: true`** bật toàn bộ; cấu hình chiến lược cache per-cell qua option (Tier 1).
- **Update flow do framework lo**: phát hiện version mới → prompt reload, không kẹt cache cũ.
- Cần **HTTPS** (đã có auto-TLS 4b). ⚠️ **Opt-in**: không app nào cũng cần offline; đừng bật mặc định.
  Offline-write đầy đủ chỉ "thật" khi có sync engine (Trục 3) — đừng hứa quá trước đó.

> Vì sao đáng làm: PWA/offline thường là dự án phụ đau đớn. fluxe cho **gần như free + đúng**
> nhờ sinh SW từ cell graph, và **cộng hưởng** thẳng với local-first (3) + realtime (4g) +
> notification (6b.J) — ba thứ đã có.

---

## 4n. Trục — Admin portal builder (kiểu Filament, nhưng tân tiến hơn)  ⭐⭐⭐

Khác **4j** (monitoring của *framework*, cố định): đây là **builder dựng back-office cho APP
của dev** — define resource per entity → có ngay full CRUD admin. Dogfood chính primitive
fluxe (cell + serializer/DTO 6b.H + ORM + RBAC 6b.F + realtime 4g) → tân tiến hơn Filament.

### Tier 0 — `defineResource(entity)` → full admin trong vài giây
- Tự sinh **list/table + filter/sort/search · create/edit form · detail · bulk action · relation**
  — **derive từ entity schema + DTO** (6b.H), 0 cấu hình. `fx gen resource <entity>` scaffold (gắn 4h/6e).
- **Form + validation tái dùng serializer/DTO** (6b.H) + lấp gap forms (review §A) — input shape, validate auto.

### Tham khảo tốt nhất hiện nay — lấy gì (khảo sát 2026)
- **Django admin**: auto-CRUD từ model, 0-config, nhanh nhất cho team đã có schema. → lấy **auto-from-schema zero-config**.
- **Filament / Nova (Laravel)**: resource khai báo + UI đẹp + form/table builder + widget + plugin. → lấy **resource declarative + ecosystem plugin**.
- **Refine / React-admin (headless React)**: **data-provider backend-agnostic** + **full code ownership** + đa UI-lib. → lấy **data-provider = biên `Backend`** + **ejectable ownership**.
- **Payload (code-first TS)**: schema → admin + API, TS-native, hiện đại. → lấy **một schema sinh cả admin lẫn API**.
- **Retool (low-code)**: kết nối nhiều nguồn, ship nhanh. → lấy cảm hứng UX nhưng **giữ code-first, không lock-in**.
> Tiêu chí 2026: **CLI + codegen + headless + full ownership + doc tốt** — fluxe đã có sẵn nền (4h/6f/6d/T4).

### Đặc biệt KHÁC & TỐT HƠN (không chỉ "bằng")
- **Một contract chạy CẢ app LẪN admin**: data-provider của fluxe **chính là biên `Backend` của app** —
  không có "admin API" riêng. React-admin/Refine cần data-provider rời; fluxe dùng lại đúng cái app đang chạy.
- **Polyglot**: admin chạy bất kể backend Go/Rust/TS — không stack admin nào làm được (đều khóa 1 runtime).
- **Type-safe đầu-cuối** từ contract + autocomplete (gắn LSP 6f) — hơn Filament (mảng PHP) / Django (Python) / Retool (config).
- **Realtime mặc định** (4g): bảng live, **presence**, optimistic lock — Django/Filament/React-admin đều request/response.
- **RCA-native**: mỗi trang admin **là một cell** (resolved) → custom = chỉ là cell; **ejectable** (6d) — không lock-in như Retool.
- **Field-level authz + audit** (6b.F) baked-in; **widget/chart** tái dùng sketch/stats (6b.G).
- **★ RCA Resolution view**: admin của fluxe có panel **không stack nào có** — xem app được giải thế nào (render/backend/placement per-cell). Bắt đầu từ devtool `/_fluxe`.

### Customize tối đa — escape-hatch 3 tầng (tenet)
- **Tier 0**: `defineResource(entity)` → admin đầy đủ.
- **Tier 1**: khai báo column/filter/form-field/action/widget/tab/theme qua option.
- **Tier 2**: thay bất kỳ trang/field bằng **cell/component tự viết** — không rời framework, không kéo cả admin xuống.

### Theo tenet & ecosystem
- HTTPS (T1) · test+doc scaffold sẵn (T4) · i18n + theming/white-label.
- **Field type / widget / theme mở rộng bằng plugin** (6e) — cộng đồng thêm component admin.

> Vì sao ⭐⭐⭐: "dựng admin nhanh" là lý do lớn dev yêu Laravel+Filament. fluxe cho bản
> **type-safe + realtime + polyglot + custom tới đáy**, dựng trên primitive đã có — không phải stack admin rời.

---

## 4o. Trục — Resource governance (đúng tầng: framework vs OS)  ⭐⭐

Câu hỏi "fluxe có nên quản RAM/vCPU/thread, limit, profiling?" → **Có, nhưng đúng tầng.
KHÔNG tái phát minh cgroups.**

### OS/orchestrator sở hữu (fluxe expose, không tự viết)
- **Hard cap RAM/CPU**: cgroups / K8s `limits`/`requests`. Process không tự cap RAM tin cậy → việc của OS.
- **Thread/scheduler**: `GOMAXPROCS` (Go), tokio (Rust). fluxe phơi knob qua config; không viết scheduler.

### Framework sở hữu (governance hợp tác — cái NÊN có)
- **Concurrency limit** per-route/per-tenant (bulkhead — T3/4f); **timeout/deadline** per-request (6b.F);
  **rate limit** (6b.F); **worker-pool sizing** cho jobs (6b.B) + hot-path.
- **Bounded by design** (chống OOM tận gốc): cache LRU có max (6b.G), queue có depth limit, **stream** payload lớn.
- **★ Per-tenant quota** (SaaS, 6c): ngân sách CPU-time / RAM / request mỗi tenant — *chỉ framework làm được*.
- **Profiling/metrics** (4f): để **đặt limit OS cho đúng** — observability dẫn đường, không đoán.

### Góc RCA (tương lai, ngoài v0.1)
"Resource budget" có thể thành **thuộc tính của Resolution**: Resolver gán deadline/concurrency
per-cell vào manifest; **PGR** (4f) nối profiling → placement. Manifest hiện là điểm cắm tự nhiên.

> Nguyên tắc: fluxe lo **concurrency/timeout/quota/bounded + observability**; OS lo **hard cap**.
> Đừng để framework giả vờ làm được việc của cgroups — đo & cô lập hợp tác, không cưỡng chế phần cứng.

---

## 4p. Trục — i18n / l10n built-in (type-safe, polyglot, lazy)  ⭐⭐

Lấp gap review §A. Khác biệt fluxe: **locale là context resolved per-request** (như backend) +
**catalog type-safe xuyên ngôn ngữ** (UI lẫn email/notification server đồng bộ).

### Tham khảo tốt nhất (lấy gì)
- **next-intl / Lingui / typesafe-i18n / FormatJS**: **ICU MessageFormat** (plural/gender/select/interp)
  + **key & param type-safe** (missing key = lỗi compile). → lấy lõi ICU + type-safe.
- **Rails/Laravel i18n**: convention + locale backend. **Tolgee**: in-context editing. **Intl API**: format chuẩn.

### Cốt lõi
- **Locale resolved per-request → `ctx.locale`**: từ URL (`/vi/`) · Accept-Language · cookie · user pref;
  inject vào `Ctx` (như backend). Loader/action/cell nhận `ctx.locale` + `t()` — **SSR đúng locale, không flash**.
- **Catalog type-safe**: `t("home.title", {n})` autocomplete (gắn LSP 6f), **missing key = lỗi build** (tenet T4),
  param ICU có kiểu. **Polyglot**: catalog codegen sang Go/Rust (mục 2) → email (6b.J)/error/server-content cùng nguồn.
- **Lazy per-cell catalog**: chỉ ship message của locale active cho cell trên trang → **0 byte locale thừa** (gắn cell model).
- **Format qua Intl**: `fmt.date/number/currency/relativeTime/list` — locale từ ctx, chuẩn ICU, không lib nặng.
- **RTL auto** (`dir=rtl` cho ar/he) · **SEO hreflang + URL localized + sitemap/locale** (gắn gap SEO §A).
- **Content localization** (6b.H): per-field translation + fallback chain trong ORM (UI strings ≠ data content).

### DX & workflow
- **`fx i18n extract`** (rút key từ code) · **`fx i18n check`** (thiếu bản dịch → CI fail, T4) · tích hợp Tolgee/Crowdin.
- **Escape-hatch 3 tầng**: Tier0 `t()` chạy ngay (locale auto); Tier1 config (supported locales, fallback); Tier2 custom resolver/formatter.

> Đặc biệt hơn: **i18n type-safe XUYÊN TS+Go+Rust** — UI string và email/notification/error server
> dịch nhất quán một nguồn. Không framework nào làm cross-language type-safe i18n. Và **locale = một
> context của RCA** (resolved như backend), không phải lib bolt-on.

---

## 4q. Trục — Error handling tốt nhất (cơ chế của tenet T5)  ⭐⭐⭐

Hiện thực hóa **tenet T5**. Khác biệt fluxe: **lỗi là giá trị có kiểu trong contract**, type-safe
**xuyên TS+Go+Rust**, và xử lý theo **escape-hatch 3 tầng**.

### Hai lớp lỗi (luật phân biệt)
- **Expected / domain error = giá trị có kiểu**: mỗi loader/action khai báo **error variants** trong
  contract (NotFound · Unauthorized · Validation · Conflict · RateLimited…), kiểu `Result<Ok, FluxeError>`.
  → client nhận **error có kiểu** (exhaustive handling), map sẵn **HTTP status + message an toàn**.
- **Unexpected = bug/panic**: **bắt ở biên request** (gắn request isolation 6b.F — panic 1 request không sập
  process); log + **report** (Sentry-style) + **trace span** (4i); trả **500 generic + `errorId`** tương quan log.

### Lan truyền & cross-language
- **Polyglot error contract**: service Go/Rust trả lỗi theo **error shape của contract** (mục 2) → map thành
  **typed client error**. Lỗi xuyên ngôn ngữ vẫn có kiểu — không stack nào làm.
- **API mode** (`?json=1`): chuẩn **RFC 7807 Problem Details** `{ type, title, status, detail, code, traceId }`.

### UI & độ bền (gắn T3)
- **Error boundary per-cell**: cell lỗi → fallback UI cell đó, phần còn lại sống. Loading/error boundary khai báo cạnh cell.
- **Action error → inline/toast + retry**; **validation error → field-level** (gắn forms/serializer 6b.H); **offline fallback** (SW 4m).
- **Trang 404/500** mặc định đẹp, override được.

### Bảo mật & quan sát
- **Prod**: che nội bộ, chỉ `errorId` (truy được tới trace 4i + log). **Dev**: stack đầy đủ + **source-map → editor** (debug bar 4l / LSP 6f).
- **Scrub secret/PII** (6b.I/4k) khỏi message/report. **Phân loại retryable vs fatal** (gắn retry/circuit-breaker 4e/6b.B).

### Escape-hatch 3 tầng
- **Tier 0**: ném/return error → framework tự log+trace+report+map status+boundary. Chạy đúng mặc định, 0 code.
- **Tier 1**: khai báo map `error → status/message`, error page tùy biến, retry policy.
- **Tier 2**: hook **`onError`** trong middleware lifecycle (6b.F) + boundary/component tự viết.

> Đặc biệt hơn: **lỗi type-safe xuyên ngôn ngữ + Result trong contract** (không phải try/catch mò),
> **secure-by-default** (không leak), **một lỗi không cascade**. Đúng tinh thần "giao engine, vẫn override sâu".

---

## 5. Deploy & runtime

- **Single binary** (Trục 4): đóng gói server + assets thành 1 file.
- **Webserver + auto-TLS tích hợp** (Trục 4b): HTTPS 1 lệnh, 0 config.
- **Throughput RPS/QPS top ngành** (Trục 4f): hot path Go/Rust, binary transport,
  per-cell cache, benchmark TechEmpower-style — số liệu chứng minh, không tự nhận.
- **Realtime native** (Trục 4g): WebSocket + SSE + **Polling** + Channel/presence, **một
  primitive transport tự thương lượng** (DX dễ nhất ngành), type-safe, fan-out đa node.
- **Distributed tracing native** (Trục 4i): một trace FE→BE→Go/Rust, propagate W3C
  Trace Context xuyên ngôn ngữ, OTel, auto-instrument — không đứt trace ở biên polyglot.
- **Admin/Monitoring dashboard mặc định** (Trục 4j): cài là có UI đẹp dùng ngay, panel
  RCA Resolution + trace + jobs + DB + realtime; dogfood bằng cell — wow on install.
- **Env/config & secrets** (Trục 4k): env là contract có kiểu, validate fail-fast,
  public/secret compiler-enforced, driver .env→Vault/Doppler/cloud, `fx env` cho CI/CD.
- **Debug bar / profiler in-page** (Trục 4l): thấy mọi hoạt động per-request (query/N+1/
  Backend hop/RCA/auth/logs), xuyên Go/Rust + SPA-aware, click-to-source — DX kiểu Debugbar.
- **Service Worker native** (Trục 4m): SW auto-generated từ cell graph — PWA/offline,
  background-sync offline writes, Web Push; cộng hưởng local-first (3) + realtime (4g).
- **Admin portal builder** (Trục 4n): `defineResource` → full CRUD admin (kiểu Filament),
  type-safe + realtime + polyglot, custom 3 tầng; khác 4j (monitoring framework).
- **CLI/tooling engine** (Trục 4h): `fx` một lệnh lo scaffold → migrate → job → svc →
  deploy + `fx console`/`fx doctor`; ngữ pháp nhất quán, tự khám phá, dễ nhớ hơn artisan.
- **Scale-out đa node + K8s-native** (Trục 4d): stateless node, probe/graceful shutdown,
  OTel, Helm/Terraform mẫu — thêm replica là scale.
- **Service discovery + microservice config-flip** (Trục 4e): monolith ↔ phân tán đổi
  config, discovery + LB + retry + mTLS native.
- **Edge / serverless adapter** + **self-host docker** một lệnh.

---

## 6. DX & cộng đồng — yếu tố quyết định "thu hút dev"

- `create-fluxe` CLI + starter templates (SaaS, blog, dashboard).
- **Demo "killer"** chạy trong 30s thể hiện rõ polyglot (vd: cell search dùng Rust,
  cell khác dùng TS).
- Docs có **playground** tương tác + bảng so sánh thẳng "fluxe vs Next vs Remix"
  trên bundle size / TTI.

---

## 6b. Frontier 2026 — Batteries-included & AI-native (từ nghiên cứu thị trường)

Khảo sát framework 2026 cho thấy **2 xu hướng thống trị** mà idea.md ở trên chưa chạm:
nhiều dev chọn framework vì **"đỡ phải lắp ráp"** (Laravel/Rails/Django/Wasp) và vì
**AI-native** đã thành một hạng mục hàng đầu. Đây là nhóm idea giá trị nhất còn lại.

### A. Batteries-included — lý do #1 dev chọn framework  ⭐⭐⭐
JS/TS ecosystem lâu nay THIẾU trải nghiệm "pin lắp sẵn" mà Laravel/Rails/Django có.
Ai lấp được khoảng này sẽ thắng lớn. fluxe nên gói sẵn (mỗi thứ vẫn nằm sau biên
`Backend` → vẫn polyglot, vẫn switch được):

- **Auth tích hợp** (đau #1 của mọi dev): session, OAuth, **passkeys/WebAuthn**, magic link
  — bật bằng config, không phải dựng Clerk/Auth.js tay. Lõi xác thực viết Go/Rust.
- **Tầng dữ liệu typed + migrations** — xem mục **6b.H** (ORM/data layer chi tiết): query
  layer type-safe đa engine + migration tự động, sinh từ cùng schema contract (mục 2).
- **Admin panel auto-generate** từ schema (kiểu Django admin) — CRUD nội bộ 0 dòng code.
- **Security defaults bật sẵn**: CSRF, rate-limit, security headers, validate input
  (zod đã có) — lõi enforce ở tầng Go/Rust, an toàn mặc định.
- **Email / file storage / queue / cache / pub-sub adapter** chuẩn hóa — xem chi tiết
  mục 6b.G (interface thống nhất, driver tráo qua config).

### B. Background jobs / durable workflows  ⭐⭐⭐ — khe hở thật của JS framework
Jobs nền, cron, retry, **durable execution** (kiểu Temporal/Inngest) là thứ hầu hết
JS framework làm yếu. fluxe có lợi thế độc nhất: **engine workflow viết Go/Rust** sau
biên `Backend` — bền bỉ, chịu tải, đúng thế mạnh ngôn ngữ biên dịch. Khai báo job
cạnh cell, fluxe lo schedule/retry/observability.

**Chống race condition native (đúng-đắn dưới tải, không phải tự lo):**
- **Atomic claim**: DB driver dùng `SELECT … FOR UPDATE SKIP LOCKED` → N worker không bao
  giờ nhận trùng một job (không cần dev nghĩ tới khoá).
- **Unique/idempotent job** (`ShouldBeUnique` kiểu Laravel): khử trùng theo key — enqueue
  trùng bị gộp; **idempotency key** cho exactly-once-effect.
- **`withoutOverlapping`**: job/cron cùng key không chạy chồng (mutex phân tán).
- **Distributed lock** (qua etcd/NATS/Redis — gắn 4d): tài nguyên dùng chung được serialize.

**Retry + backoff native (bền bỉ mặc định):**
- **Exponential backoff + jitter**, `maxAttempts`, `retryUntil`, **dead-letter queue** khi cạn retry.
- Phân loại lỗi: retryable vs fatal (fail nhanh, không phí retry); **rate-limit** job theo key.

**Cron / scheduled (an toàn đa node):**
- Khai báo lịch cạnh job; **`onOneServer`/leader election** (gắn 4d) → cron chỉ chạy ở **một
  node** dù N replica, không trùng. Tự bỏ lần chạy nếu lần trước chưa xong.

**Switch driver — DB mặc định 0-infra lúc init:**
- **`init` dự án có sẵn queue chạy trên DB** (Postgres/SQLite — SKIP LOCKED) → **chạy ngay,
  không dựng hạ tầng**. Sau đó **đổi config** sang **RabbitMQ · SQS · Redis · NATS JetStream**
  khi scale — **job code KHÔNG đổi** (driver interface 6b.G). Đúng "in-memory/DB khi dev → cloud khi scale".
- **Job batching + workflow/chaining** (durable, kiểu Temporal): bước sau chờ bước trước, resume sau crash.

### C. AI-native primitives — hạng mục first-class 2026  ⭐⭐⭐
Streaming UI, tool-calling, structured output, agent/memory đã thành chuẩn (Vercel AI
SDK, Mastra…). fluxe biến chúng thành **nguyên thủy hạng nhất**, không phải lib lắp thêm:

- **AI cell**: cell loader có thể **stream** token ra (gắn với Streaming SSR, Trục 2).
- **Tool-calling = action**: dùng lại đúng cơ chế `action`/`rpc()` hiện có làm "tool"
  cho LLM — model gọi action server an toàn, type-safe.
- **Inference/agent runtime polyglot**: chạy embedding/RAG/vector search bằng **Rust**
  cho nhanh-rẻ, sau biên `Backend` — cell không biết model chạy ở đâu.
- **RAG/vector store adapter** chuẩn hóa.

### D. AI-coding–first: app manifest khai báo  ⭐⭐ (xu hướng mới, đừng bỏ lỡ)
Coding agent (Claude Code, Cursor…) giờ là "người dùng" chính của framework. Framework
có **một manifest khai báo** mô tả routes/auth/data/jobs/cells để agent đọc-sửa dễ sẽ
được AI sinh code chính xác hơn → lan truyền nhanh. (Wasp đang thắng nhờ đúng điểm này.)

### F. Kiến trúc request: middleware chain + guard + authz native  ⭐⭐⭐
Mọi app nghiêm túc cần một **pipeline request** chuẩn, type-safe, bảo mật mặc định.
fluxe nên có sẵn (không phải lắp Express/Hono tay), enforce ở **server-side qua biên
`Backend`** nên client không bypass được; phần nặng (policy, rate-limit) chạy Go/Rust.

- **★ Request isolation — mỗi request độc lập, KHÔNG rò state (đúng-đắn dưới tải)**:
  mỗi request có **context riêng, scoped** (auth · tenant · `trace_id` 4i · **deadline +
  cancellation**), inject qua `Ctx` (đã có `ctx.backend`) — **không global mutable state**.
  Sửa đúng footgun SSR kinh điển (singleton/module-state rò giữa user). **Bulkhead per-request**
  (gắn T3): một request lỗi/chậm không kéo cái khác. Host Go = goroutine/request, Rust = async task — cô lập thật.
- **Quản chặt request→response (lifecycle hook có kiểu)**: `onRequest · beforeLoader ·
  afterAction · onResponse · onError` + **body-size limit · timeout/deadline per request ·
  streaming response · ETag/304 · compression** — kiểm soát chặt hai đầu, không rò.
- **Tối ưu RPS/QPS**: xem **Trục 4f** (router radix-tree, zero-alloc path, load-shedding,
  binary transport) — request isolation + middleware ở đây bổ sung mặt **đúng-đắn**, 4f lo mặt **tốc độ**.
- **Middleware chain đa tầng, composable & typed**: xếp lớp global → route → cell →
  action, thứ tự rõ ràng, mỗi middleware có context type-safe, short-circuit được.
  Áp dụng cho cả loader lẫn action, chạy được ở tầng SSR và/hoặc service polyglot.
  Defense-in-depth: middleware bảo mật (headers, CSRF, body limit) bật **mặc định**.
- **CORS / XSS / CSRF native (bật sẵn, secure-by-default)**:
  - **CORS**: enforce server-side (host Go), **deny-by-default + allowlist tường minh**,
    tự xử preflight `OPTIONS`, khai báo per-route/global, **chặn footgun** `*` + credentials.
  - **XSS**: React **auto-escape** + **CSP nonce-based** cho script island + guard
    `dangerouslySetInnerHTML` + tùy chọn Trusted Types; sanitize HTML user qua lib vetted.
  - **CSRF**: hợp mô hình `rpc()`/action — **double-submit token + SameSite + kiểm Origin/
    Referer** ngay tại biên action, bật mặc định. (Chi tiết crypto token: 6b.I.)
- **Guard khai báo cạnh cell**: `guard: [auth, role("admin")]` chạy TRƯỚC loader/action,
  fail thì chặn sớm — không nhét if-check rải rác trong business logic.
- **RBAC + ABAC native, tiên tiến**: không chỉ role tĩnh. ABAC theo thuộc tính
  (user, resource, môi trường) qua **policy engine** (lấy cảm hứng Cedar/OPA), policy
  khai báo, đánh giá ở lõi **Rust/Go cho nhanh & an toàn**. Hỗ trợ ownership-based
  ("chỉ chủ sở hữu sửa"), multi-tenant isolation, field-level permission.
- **JWT bảo mật native**: ký **EdDSA/ES256** (không HS256 yếu mặc định), token sống
  ngắn + refresh rotation, **JWKS** + xoay khóa tự động, cookie `HttpOnly/Secure/SameSite`
  mặc định, chống replay. Tùy chọn session-based để revoke tức thì. Lõi verify ở Rust/Go.
- **Rate limiting native**: token-bucket/sliding-window theo IP / user / route / API key,
  **phân tán** (chia sẻ qua Redis — gắn Trục 4d scale-out), trả `429 + Retry-After`
  chuẩn. Lõi đếm ở Go/Rust, nhanh, không tốn tài nguyên app node.
- **Audit log + security event** sẵn: ai làm gì, authz pass/deny — cắm thẳng observability.

> Vì sao tiên tiến hơn: incumbent JS để authz/rate-limit cho lib bên thứ ba, chạy
> trong JS, dễ lệch giữa client/server. fluxe enforce **một nguồn sự thật ở biên
> `Backend`**, policy engine biên dịch (Rust/Go) → vừa nhanh, vừa khó bypass, vừa
> nhất quán đa node.

### I. Crypto & hardening — bảo mật "cứng", best-practice, khó dùng sai  ⭐⭐⭐
Lõi crypto chạy **Go/Rust vetted, sau biên `Backend`**. Nguyên tắc: **API misuse-resistant**
(dev **không chọn được** thuật toán yếu) + **secure-by-default** + **không tự chế crypto**
(dùng libsodium/age, RustCrypto/ring, Go crypto).

- **Hash mật khẩu đúng chuẩn**: **Argon2id** mặc định (OWASP), fallback bcrypt/scrypt; salt
  per-user + **pepper**; **tự re-hash khi nâng cost lúc login**. **Cấm** MD5/SHA-thuần cho password.
  API: `password.hash()` / `password.verify()` — không lộ tham số nguy hiểm.
- **Mã hóa payload khi cần (AEAD-only)**: `seal()/open()` dùng **XChaCha20-Poly1305 / AES-GCM**
  — luôn xác thực, không bao giờ raw cipher. Mã hóa field nhạy cảm (PII) ở DB (gắn ORM 6b.H),
  hoặc payload `rpc()`/channel (4g) khi cần end-to-end. Nonce sinh tự động, không để dev sai.
- **Quản khóa envelope + KMS**: DEK/KEK, tích hợp Vault/cloud KMS (gắn secrets 4k), **xoay khóa**
  không downtime, **per-tenant key** (gắn multi-tenancy 6c).
- **Crypto-shredding cho GDPR**: mỗi record/tenant một khóa → **xóa khóa = xóa dữ liệu** (right-to-erasure gọn).
- **Toàn vẹn & ký**: HMAC, **signed cookie**, CSRF token, **xác minh chữ ký webhook** — built-in.
- **Phòng thủ tầng web mặc định**: CSP/security headers, chống XSS (output encoding), chống SQLi
  (param hóa — ORM 6b.H), **constant-time compare**, **CSPRNG** cho mọi token/id.
- **In transit**: TLS 1.3 (4b) + mTLS giữa service (4e) bật sẵn.
- **JWT/token**: xem 6b.F (EdDSA, short-lived, rotation).

> Vì sao "cứng": dev gọi primitive đơn giản (`hash/verify/seal/open/sign`), **mọi lựa chọn
> nguy hiểm bị giấu/khóa** ở Resolution Plane → khó dùng sai theo thiết kế, không phải nhờ kỷ luật.

### G. Infrastructure drivers — interface thống nhất, tráo qua config  ⭐⭐⭐
Cùng triết lý với biên `Backend`: mỗi hạ tầng là **một interface, nhiều driver**, chọn
bằng config — code nghiệp vụ không đổi khi đổi driver (local ↔ cloud). Mặc định an toàn,
driver nặng (đếm, fan-out) chạy lõi Go/Rust. Đây là "pin lắp sẵn" kiểu Laravel cho fluxe.

- **Queue (hàng đợi)** — interface `enqueue/process/retry/delay`. Driver: **in-memory**
  (dev), **DB mặc định** (Postgres/SQLite, `SKIP LOCKED` — **0 hạ tầng lúc init**),
  **RabbitMQ · SQS · Redis · NATS JetStream**. Là nền cho durable jobs (6b.B) với
  atomic-claim/retry/backoff/dead-letter + chống race/overlap mặc định. Đổi driver = đổi
  config, **job code giữ nguyên**.
- **Storage (lưu trữ file)** — interface `put/get/url/delete/stream`. Driver: **local
  disk** (dev/self-host), **S3** (+ tương thích R2/MinIO/GCS), Azure Blob. Hỗ trợ
  signed URL, multipart upload, stream lớn. Local ↔ S3 đổi config, không sửa code.
- **Cache** — interface `get/set/ttl/tags/invalidate`. Driver: **in-memory** (LRU,
  per-node), **file**, **Redis** (chia sẻ đa node — gắn scale-out 4d). Nền cho per-cell
  cache (Trục 4f) + stale-while-revalidate; hỗ trợ tag-based invalidation.
- **Pub/Sub native** — interface `publish/subscribe` theo topic. Driver: **in-memory**
  (1 node), **Redis**, **NATS**, Postgres LISTEN/NOTIFY. Là **xương sống fan-out đa node**
  cho Channel/SSE (Trục 4g) và sync engine (Trục 3); tách app khỏi việc chọn broker.

> Nguyên tắc: in-memory để chạy ngay khi dev (0 hạ tầng), cloud driver khi scale —
> **một dòng config, không rewrite**. Đúng tinh thần "switch backend" đã chứng minh.

#### NATS — backbone hạ tầng thống nhất (khuyến nghị làm driver mặc định)  ⭐⭐⭐
NATS hợp fluxe đến mức phủ **nhiều trục bằng một thành phần**, giảm số mảnh phải vận hành:
- **Pub/Sub + fan-out đa node** (6b.G, 4g, 4d): xương sống broadcast cho Channel/SSE + sync (Trục 3).
- **Queue/jobs** (6b.G, 6b.B): **JetStream** = stream bền + queue group, at-least-once, retry, DLQ.
- **Service discovery + RPC** (4e): **request-reply + queue group** → RPC location-transparent,
  load-balanced sẵn — gần như **không cần registry discovery riêng**.
- **KV store** (JetStream KV): config, feature-flag, session, backing cache, **distributed
  lock / leader election** cho jobs khỏi chạy trùng (4d).
- **Multi-tenancy** (6c): **accounts** cô lập tenant ở mức broker + authz + mTLS built-in.

**Vì sao khớp ethos fluxe:** `nats-server` là **single binary, embeddable trong Go** →
**dev = 0 hạ tầng ngoài** (nhúng embedded), **prod = cluster** chỉ đổi config (khớp Trục 4
single-binary + nguyên tắc "in-memory khi dev, cloud khi scale"). Client **polyglot** Go/
Rust/TS chính thức; **leaf node + supercluster** hợp edge/multi-region (Trục 4).

> ⚠️ Không lock-in: NATS là **backbone mặc định khuyến nghị**, KHÔNG bắt buộc — vẫn giữ
> interface driver để tráo Redis/SQS/Postgres. Giá trị: **1 thành phần thay cho 4**
> (pub/sub + queue + RPC/discovery + KV).

#### Ứng viên backbone khác (lọc theo ethos: Go-embeddable / Rust hot-path, single-binary)
Mỗi cái là **driver giải xuống một trục RCA** — chọn theo nhu cầu, không cưới.

| Vai trò (trục) | Ứng viên | Ngôn ngữ/embeddable | Ghi chú vs NATS |
|----------------|----------|---------------------|-----------------|
| **Coordination mạnh** (leader/config/discovery, CP/Raft) | **etcd** ⭐ | Go, nhúng được | Mạnh hơn NATS KV ở **strong consistency**; thêm **chỉ khi cần CP-grade** |
| ″ nhúng thẳng | dragonboat / hashicorp-raft | Go lib | Tự nhúng consensus, khỏi service ngoài |
| **KV local bền per-node** | **Pebble** / BadgerDB | Go embedded | Cache/state cục bộ **0 hạ tầng ngoài** — single-binary thuần |
| **SQL nhúng + edge** | **SQLite / libSQL (Turso)** ⭐ | C/Rust embedded | Data backbone single-binary + replication edge (Trục 4) |
| **Blob/Storage self-host** | **MinIO** ⭐ | Go single-binary | **S3-compatible** → driver Storage self-host |
| **Cache chia sẻ nhanh** | **Dragonfly** / Redis | C++ single-binary | Redis-API đa luồng, nhanh hơn |
| **Streaming/event-log nặng** | **Redpanda** | C++, Kafka-API | Chỉ khi event-sourcing lớn; không JVM/ZK. Đa số NATS đủ |
| **CRDT/sync** (Trục 3) | **Loro** ⭐ / Automerge-rs / y-crdt | **Rust** | Lõi sync Rust hot-path |
| **Search/vector** (6b.C) | **Tantivy** · **Qdrant/LanceDB** | **Rust** | RAG/search sau biên `Backend` |

**etcd vs NATS — bổ sung, không trùng:** NATS = messaging-first (pub/sub/queue/fan-out + KV
mềm, eventually-available, đủ đa số); etcd = coordination-first (**strong consistency Raft**
cho leader/config khi đúng-đắn > sẵn-sàng). → NATS mặc định; etcd chỉ khi cần CP-grade.

**Bộ backbone tối thiểu "all-in-one":** NATS (messaging/realtime/queue) · Pebble (state local
0-infra) · SQLite/libSQL→Postgres (data) · local→MinIO/S3 (storage) · Loro + Tantivy/Qdrant
(sync + search, Rust) · etcd (coordination mạnh — tùy chọn). Tất cả **sau interface driver
(6b.G)** — backbone là *lựa chọn giải*, không phụ thuộc cứng.

#### Capability "sketch/stats" — cấu trúc dữ liệu xác suất (HLL, Bloom, CMS…)  ⭐⭐
Compute primitives thuộc **Rust/Go hot-path, sau biên `Backend`**. Khớp fluxe vì **mergeable**
→ fan-out đa node: mỗi node giữ sketch cục bộ, **merge qua NATS/etcd** → ước lượng toàn cục rẻ.

- **Interface**: `cardinality/contains/topk/quantile/freq` + **`merge`** (phơi ra cho đa node).
- **Driver in-process (single-node, 0 infra)**: Go `axiomhq/hyperloglog`, `bits-and-blooms/bloom`,
  `dgryski/go-topk`, `influxdata/tdigest`/DDSketch; Rust `hyperloglogplus`, `sketches-ddsketch`.
- **Driver chia sẻ**: **Redis HLL** (`PFADD`) + **RedisBloom** (Bloom/Cuckoo/CMS/TopK/t-digest);
  hoặc **Apache DataSketches** (Theta sketch — union/intersection mạnh hơn HLL).
- **Dùng trong trục đã có**: rate-limit/dedup (Bloom/Cuckoo — 6b.F) · unique-visitor + heavy-hitter
  + p99 (HLL/TopK/DDSketch — dashboard 4g) · dedup queue/jobs (6b.B) · MinHash near-dup (AI 6b.C).
- ⚠️ **Xấp xỉ có sai số chặn**: dùng khi exact quá đắt (cardinality khổng lồ/streaming); **KHÔNG**
  cho billing/auth. Luôn nêu error bound.

### ⚠️ Đối thủ gần nhất cần theo dõi: **Wasp**
Wasp cũng dùng **compiler + file khai báo** sinh ra app full-stack (React+Node+Prisma),
batteries-included, mạnh về AI-coding. Đây là đối thủ ý tưởng gần fluxe nhất — NHƯNG
Wasp khóa trong **Node/Prisma**, không polyglot. **Khác biệt sống còn của fluxe vẫn là
biên ngôn ngữ Go/Rust** (đã chứng minh). Đừng để Wasp định nghĩa hạng mục này trước.

**✅ Học gì từ Wasp (không phá đặc trưng):**
- **Generated code minh bạch + eject được**: Wasp ghi ra `.wasp/`, dev sở hữu, no lock-in.
  → fluxe làm `.fluxe/` glue **inspectable + ejectable** — gỡ nỗi sợ "magic đen", xây niềm tin.
- **Auto cache/query invalidation theo entity**: action đụng entity nào → tự revalidate
  loader/cache liên quan. DX mượt, hợp cơ chế loader/action + cache (4f) sẵn có.
- **Một nguồn topology cho compiler + AI**: `main.wasp.ts` cho cả compiler lẫn coding agent
  thấy toàn cảnh app → AI sinh code chuẩn (6b.D). Bài học: compiler fluxe nên có topology graph.

**❌ KHÔNG copy (phá identity):** ① **spec-first DSL** (file khai báo là nguồn chính) — fluxe
**code-first `defineX`** = Contract Plane, thêm DSL riêng sẽ xé đôi mô hình tư duy; ② **compiler
Haskell** — fluxe chọn resolver TS cho adoption; ③ **khóa Node/Express/Prisma** — đối nghịch
polyglot; ④ **cưới TanStack Query** — giữ render/data layer pluggable.

**🔑 Tổng hợp (lấy lợi, bỏ hại):** compiler fluxe **tự dựng topology graph TỪ các `defineCell`/
`defineContract` rải rác (code-first), rồi EMIT manifest đọc-được cho AI/tooling** — có lợi
ích "một nguồn topology" của Wasp **mà không cần ngôn ngữ khai báo thứ hai**. Manifest là
*output dẫn xuất*, không phải *input viết tay*. Đúng RCA: dev sống ở Contract Plane, compiler lo phần còn lại.

### E. Định vị hiệu năng–chi phí  ⭐
Polyglot Rust/Go ⇒ ít RAM, khởi động nhanh, **hosting rẻ hơn nhiều** so với stack
Node. "Cùng app, hóa đơn server 1/N" là thông điệp ops + indie dev cực dễ bán.

### H. Tầng ORM / Data layer — đa engine, DX cực tốt, polyglot  ⭐⭐⭐
Tầng data là thứ dev quan tâm bậc nhất — phải mạnh. Học ORM tân tiến nhưng **không phá
code-first/RCA**.

**Học gì (lọc theo ethos):**
- **Drizzle** ⭐ — *schema code-first bằng TS*, SQL-like, đa engine, edge-friendly. **Khớp
  `defineX` nhất.** Lấy làm mô hình authoring.
- **Prisma** — DX migrations + **Studio GUI** + introspection hàng đầu. Lấy DX. **Bỏ DSL riêng**
  (xé code-first, đúng tension Wasp).
- **Kysely** — query builder type-safe thuần + **raw SQL escape hatch**. Lấy lõi query + lối thoát.
- **Ent/sqlc (Go), SQLx/SeaORM (Rust)** — bản query layer cho service polyglot.

**Synthesis cho fluxe (RCA áp cho data):** ORM **không sống trong cell, sống sau biên
`Backend`** → cell ORM-agnostic. **Một schema code-first (TS) là nguồn sự thật → codegen
typed access cho cả 3 ngôn ngữ** (Drizzle TS · sqlc/Ent Go · SQLx Rust), migration sinh từ
cùng schema → **type-safe xuyên ngôn ngữ**. Đây là mục 2 mở rộng sang quan hệ + bảng.

> ⚠️ **KHÔNG tự viết ORM từ đầu** (bẫy nhiều năm: query planner, quirk dialect, migration
> diff… — vi phạm tenet "không tái phát minh hạ tầng"). fluxe **bọc** ORM tốt nhất mỗi ngôn
> ngữ (Drizzle/Kysely · sqlc/Ent · SQLx/SeaORM) và chỉ viết **3 lớp mỏng fluxe-native**:
> (1) schema-as-contract → codegen đa ngôn ngữ (mục 2); (2) migration orchestration thống
> nhất (`fx db`); (3) repository interface phơi cho cell. Tức **lớp cầu nối + điều phối, KHÔNG
> phải query engine**.
> **v0.1**: bọc thẳng **Drizzle cho TS** (memory + Postgres backend), **0 dòng ORM tự viết**;
> codegen đa ngôn ngữ làm sau khi Resolver core chạy.

**Serializer / DTO — model↔wire mapping (vai trò của DRF Serializer, làm hiện đại hơn):**
- Vấn đề thật phải xử lý: **shape model (DB) ≠ shape wire (API) ≠ shape view** — không được rò DB ra client.
- fluxe **gập "serializer" vào contract**: serialize = tự động qua wire layer (mục 2); validate
  = tự suy từ schema. **Không cần Serializer class imperative** (DRF cần vì Python thiếu static type).
- **Tách 3 lớp schema**: **Entity** (DB, 6b.H) · **DTO/View contract** (shape phơi qua `Backend`)
  · **Input (write) tách Output (read)**.
- **ModelSerializer equivalent = `defineView`/`defineDTO` derive từ entity**: Tier 0 auto
  `entity.pick()/.omit()/.extend()` (Zod) → DTO mặc định, DRY; Tier 2 thêm computed field,
  nested/relation + depth, rename/mask/transform (escape-hatch 3 tầng).
- **Field-level authz** (ẩn field theo role, gắn 6b.F) — chống over-exposure/mass-assignment.
- **Collection/pagination envelope** + **versioning wire shape** (gắn gap public API §A).
- **Polyglot**: DTO contract codegen sang Go/Rust → serialize nhất quán mọi service. → type-safe,
  ít boilerplate, xuyên ngôn ngữ — **hơn DRF Serializer**.

**Đa engine + DX (yêu cầu cụ thể):**
- **Đa engine qua dialect**: cùng code chạy **PostgreSQL · MySQL · SQLite/libSQL** — đổi
  engine = đổi config (trục State driver RCA).
- **`fx db`**: `gen` (typed access) · `migrate` (auto từ schema) · `studio` (GUI) · `seed` ·
  `introspect` (DB sẵn → schema).
- **Hết N+1 mặc định** (auto-batching/DataLoader cho relations).
- **Type-safe đầu-cuối** (autocomplete cột/quan hệ) + **raw SQL escape** khi cần.
- **Auto-invalidate cache theo entity** (bài học Wasp): action đụng bảng nào → revalidate loader.
- **Edge/serverless-friendly** (không engine binary nặng); **branching/preview DB** mỗi PR (gắn 6c).

### J. Notifications + Mail — một định nghĩa, nhiều kênh, luôn đồng bộ (học Laravel)  ⭐⭐⭐
Bài học cốt lõi Laravel: **mail KHÔNG phải module riêng — mail chỉ là MỘT kênh** của hệ
notification thống nhất. Một định nghĩa thông báo → giao qua nhiều kênh, **không bao giờ lệch nhau**.

- **`defineNotification` — một nguồn, nhiều kênh**: `channels(user)` quyết định gửi qua
  **mail · in-app (DB) · push · SMS · Slack/webhook · realtime (Channel 4g) · broadcast**.
  Mỗi kênh format từ **cùng một payload có kiểu** (contract, mục 2) → nội dung đồng bộ tuyệt đối.
- **★ Đồng bộ mail ↔ in-app ↔ realtime**: gửi notification = vừa **mail**, vừa **lưu DB** (6b.H,
  notification center + unread count), vừa **đẩy live** qua Channel (4g) → chuông kêu ngay,
  badge cập nhật tức thì. Một hành động, mọi bề mặt nhất quán.
- **Mail driver-based (ethos 6b.G)**: dev = **log/mailpit-style 0 hạ tầng** (xem ngay trong
  debug bar 4l / dashboard 4j); prod = **SMTP · SES · Resend · Postmark · Mailgun** — đổi config.
- **Template component-first**: **React Email/MJML** (dùng lại cell/JSX) + markdown; **`fx mail
  preview`** + dev mailbox UI; **i18n** template.
- **Queued mặc định** (gắn jobs 6b.B): gửi async, retry, DLQ — không chặn request; lõi gửi
  scale chạy Go/Rust sau biên `Backend`.
- **Preference + digest**: user opt-in/out từng kênh; gộp batch/digest chống spam; quiet hours.
- **Type-safe + đa ngôn ngữ**: service Go/Rust cũng phát cùng notification qua contract.

> Vì sao ⭐⭐⭐: "thông báo" là nhu cầu phổ quát mà dev hay tự ghép rời rạc (mail một nơi,
> in-app một nơi → lệch). fluxe gói **một định nghĩa → mọi kênh đồng bộ**, realtime sẵn nhờ 4g,
> driver local→cloud — DX kiểu Laravel nhưng có thêm realtime + polyglot.

---

## 6c. Idea bổ sung đáng giá (lọc theo: hợp USP polyglot + ảnh hưởng adoption)

> Đã qua phần "trục chiến lược". Nhóm dưới là idea giá trị cao còn lại, đánh dấu mức
> ưu tiên. Bỏ qua loại nice-to-have (i18n, image-opt… — table-stakes, làm sau).

### Cao — gắn trực tiếp USP, quyết định traction

- **Contract testing xuyên biên ngôn ngữ ⭐⭐⭐**: từ schema (mục 2) **tự sinh test**
  kiểm chứng service Go/Rust/TS có tôn trọng hợp đồng `Backend` không. Đây là thứ độc
  nhất fluxe làm được nhờ polyglot — bắt lỗi lệch contract giữa các ngôn ngữ TRƯỚC khi
  deploy. Không framework nào có. (PoC tự nhiên kế tiếp sau codegen.)
- **Incremental adoption / "Bring your own backend" ⭐⭐⭐**: cho phép **nhúng fluxe vào
  app Go/Rust/Node có sẵn** (strangler-fig), hoặc bọc service hiện hữu sau biên `Backend`.
  Framework thắng nhờ đường vào dễ, không bắt rewrite. Quyết định việc fluxe có được
  dùng thật hay chỉ để chơi.
- **WASM plugin/extension system ⭐⭐⭐**: plugin viết bằng **bất kỳ ngôn ngữ nào compile
  ra WASM**, chạy sandbox an toàn. Đây là cách mở rộng hệ sinh thái đúng tinh thần
  polyglot — module ecosystem kiểu Nuxt nhưng **đa ngôn ngữ + sandboxed**. Vừa là cơ chế
  growth cộng đồng, vừa là khác biệt kỹ thuật.

### Khá — mở thị trường lớn

- **Multi-tenancy / SaaS primitives ⭐⭐**: tenant isolation first-class, per-tenant data
  + custom domain (gắn on-demand TLS 4b) + tenant-scoped ABAC (6b.F). Nhắm thẳng thị
  trường xây SaaS — phân khúc trả tiền nhiều nhất.
- **Content layer (MDX / content collections) ⭐⭐**: để cạnh tranh Astro ở mảng site/blog/
  docs — file-based content, type-safe, render static 0 JS (hợp cell `static`). Mở rộng
  fluxe ra ngoài app, kéo thêm tập dev marketing/docs.
- **Preview environments + DB branching ⭐⭐**: mỗi PR một môi trường ephemeral (kiểu Neon).
  Cold start <5ms + single-binary làm điều này rẻ — DX hiện đại dev mong đợi.

### Đáng cân nhắc

- **Realtime collab primitives** (presence, cursor, live query) — bản mở rộng của sync
  engine Trục 3, nhắm dạng app Figma/Notion.
- **Feature flags / config / A-B testing** built-in, đánh giá ở lõi Go/Rust.
- **Offline / PWA** — hệ quả tự nhiên của local-first (Trục 3).
- **Built-in observability dashboard** — UI xem trace/log/RPC ngay trong dev (mở rộng 4c).

> Thành thật: tới đây là **diminishing returns** về việc liệt kê. Giá trị tiếp theo nằm
> ở **chọn 1–2 trục lõi và dựng PoC thật**, không phải thêm idea. Xem mục 8.

---

## 6d. Đóng gói — Core engine ẩn, DX mỏng (packaging phản chiếu RCA)  ⭐⭐⭐

Mục tiêu: gói engine + RCA + cell vào **một core repo**; dev chỉ **import một bề mặt mỏng**
và vận hành thứ thấy được; **toàn bộ engine ẩn**, là dependency, không import trực tiếp.
Điểm đẹp: cách đóng gói **trùng khít hai mặt phẳng RCA** — không phải thiết kế thêm.

### Tham khảo thị trường (đã thành công) — copy gì
- **Next.js**: app chỉ import `next`; bundler/server/`.next` ẩn; **`exports` map khóa bề
  mặt**; CLI `next dev/build`. → thin import + CLI + build ẩn + exports map.
- **Nuxt**: `defineX()` macro + auto-import + `.nuxt` sinh tự động + module API. →
  **đúng pattern `defineCell` đã có** + glue sinh tự động + biên module.
- **RedwoodJS**: có sẵn khái niệm **"Cells"**, monorepo web/api, generators. → đóng gói
  cell + generator.
- **Blitz / Convex**: **zero-API**, gọi server function trực tiếp, RPC ẩn tiệt. → giấu
  **toàn bộ transport** sau lời gọi có kiểu (đúng trục Transport RCA).
- **Laravel**: Facade che container, config driver, `artisan`. → facade + drivers (6b.G)
  + CLI `fx` (4h).
- **Expo**: giấu native (Swift/Kotlin) sau JS + build dịch vụ. → **giấu Go/Rust sau
  JS/config** + `fx` build.
- **Vite/SvelteKit**: `defineConfig` + adapter ẩn deploy target. → adapter ẩn Location/Scale.

> Bài học chung: app chỉ chạm **3 thứ** — `defineX()` có kiểu · quy ước thư mục · CLI.
> Còn lại ẩn. Cơ chế *cưỡng chế*: **`package.json` "exports" map** chỉ hé path công khai.

### Engine viết bằng ngôn ngữ nào — quyết định: Go host + Rust hot + TS compiler/SSR
> Engine không một ngôn ngữ; mỗi phần **resolved xuống substrate tối ưu** (chính RCA áp
> cho engine). Nhưng **host chính = Go**.

| Phần engine | Ngôn ngữ | Lý do ngắn |
|-------------|----------|------------|
| **Host vận hành** (server, router, auto-TLS, discovery, drivers, queue, pubsub, WS, single-binary) | **Go** ⭐ | goroutine cho vạn kết nối; **CertMagic** (4b), **nats nhúng** (6b.G); **1 static binary** (Trục 4); compile nhanh (4c); dễ đóng góp → cộng đồng |
| **Hot compute** (sync/CRDT Trục 3, vector/RAG 6b.C, codec zero-copy, cell nặng) | **Rust** ⭐ | không-GC, zero-copy, nhanh nhất chỗ CPU-bound; nằm sau biên `Backend` |
| **Resolver/compiler** build-time (bộ não Resolution Plane) | **TypeScript** | phải đọc type TS/Zod + cắm esbuild/Vite |
| **SSR/React tier** | **TS/JS (bắt buộc)** | `renderToString`/streaming là JS; không viết lại React |

- **Vì sao Go làm host, không phải Rust**: single-binary là sát thủ của Go (Trục 4); đúng
  thư viện đã viện dẫn (CertMagic 4b, nats nhúng 6b.G); goroutine hợp realtime (4g); compile
  nhanh + dễ đóng góp (adoption). GC Go thừa cho orchestrator I/O-bound; phần nóng → Rust.
- **Không để tất cả Rust**: iteration chậm + rào cản đóng góp cao (hại cộng đồng); lợi perf
  I/O-bound so với Go nhỏ. Rust chỉ cho CPU-bound.
- ⚠️ **SSR + single-binary (thành thật)**: React SSR cần JS runtime. Cell `static` (0 JS,
  build ra HTML) → Go phục vụ thẳng, không cần JS. Cell `island`/SSR động → Go host **giám
  sát worker Node** (ship kèm) hoặc nhúng JS engine — quyết định kỹ thuật thật, không phải
  "một binary thuần Go làm hết".

### Layout đề xuất — 1 monorepo, 2 tầng khớp RCA
**Bề mặt công khai (Contract Plane — thứ DUY NHẤT dev import):**
- `@fluxe/core` — `defineCell` / `defineContract` / `defineBackend` + types. **Toàn bộ API authoring.**
- `@fluxe/cli` (`fx`) — vận hành: dev/build/gen/migrate/deploy/console (Trục 4h).
- `create-fluxe` — scaffolder.

**Engine ẩn (Resolution Plane — pure dependency, app KHÔNG import):**
- `@fluxe/compiler` — resolver RCA (giải 6 trục).
- `@fluxe/runtime` — SSR, router, transport (FB/capnp/JSON).
- `@fluxe/drivers-*` — queue/cache/storage/pubsub/NATS.
- `@fluxe/native-go`, `@fluxe/native-rust` — runtime + codegen polyglot.

### Cưỡng chế ranh giới (để "ẩn" là thật, không phải quy ước miệng)
- **`exports` map** ở `@fluxe/core` chỉ hé API authoring; internals không có path → không với vào được.
- **Lint rule** cấm import sâu vào `@fluxe/compiler|runtime|native-*`.
- Engine nói với app **chỉ qua**: `defineX` + quy ước file + **glue sinh tự động** (`.fluxe/`). Không chiều ngược.
- **Semver kỷ luật**: internals churn thoải mái, facade `@fluxe/core` ổn định (cách Next/Laravel tiến hóa không vỡ app).
- **Single binary** gói cả engine Go/Rust + runtime: dev chỉ viết TS, `fx` lo phần còn lại (Trục 4/4h).

> Vì sao không phải làm thêm: Contract Plane ↔ package công khai, Resolution Plane ↔
> package ẩn. **Packaging là hệ quả trực tiếp của RCA** — kiến trúc tự quyết cách đóng gói.

---

## 6e. Plugin / Module / Extension system — động cơ network-effect  ⭐⭐⭐

Điểm mạnh **cuối cùng và quyết định sống còn**: framework thắng hay chết vì **hệ sinh thái**
(WordPress, VS Code, Nuxt, Astro). fluxe có lợi thế gốc: **vì mọi concern đã là interface +
driver, plugin chỉ là "thêm một implementation tại một extension point có sẵn"** → module hóa
là **hệ quả của RCA**, không phải tính năng vá thêm.

### Extension point — plugin cắm được vào mọi trục (tất cả đã là interface)
Driver hạ tầng (6b.G/H, 4k) · Backend ngôn ngữ mới · cell/UI component · middleware/guard
(6b.F) · lệnh `fx` (4h) · **panel dashboard** (4j) · renderer (4f) · transport/wire (mục 2) ·
auth provider (6b.A) · **compiler pass của Resolver** (Trục 1). → cộng đồng mở rộng *bất kỳ
phần nào* mà không fork core.

### Ba loại plugin (đa dạng theo nhu cầu)
- **Module TS/JS** (phổ biến, kiểu **Nuxt module / Vite plugin**): hook vào build + runtime,
  `defineFluxeModule()` với hook có kiểu (config/build/request/render/deploy).
- **WASM plugin** (gắn 6c): **đa ngôn ngữ + sandbox an toàn** — cho extension untrusted/bên thứ ba.
- **Native Go/Rust module**: cho extension cấp engine (driver, hot compute) biên dịch vào.

### Cơ chế (an toàn + module hóa mạnh)
- **Hook lifecycle có kiểu** + **capability-based**: plugin khai báo nó *cung cấp* gì / *cần* gì
  → compose không xung đột vì mỗi cái nhắm một interface rõ ràng.
- **Sandbox + permission** cho WASM/untrusted; **semver compat** kiểm tra lúc cài.
- **Cô lập lỗi**: plugin hỏng không kéo sập core (đặc biệt WASM).

### DX & scale (yêu cầu của bạn)
- **`fx add <plugin>`** cài + tự wire; **`fx plugin new`** scaffold; **hot-reload plugin trong dev** (4c).
- **Plugin API có kiểu** + template; **registry/marketplace** discoverable (kiểu Nuxt modules /
  Astro integrations / VS Code marketplace) — động cơ growth network-effect.
- Plugin tự đăng ký **lệnh `fx`** (4h) và **panel dashboard** (4j) của nó → mở rộng cả tooling lẫn UI.

### ★ Plugin/Module builder — CLI sinh boilerplate chạy-được-ngay (DX "bắt đầu luôn")
Mục tiêu: `fx plugin new` xong là **chạy thấy nó hoạt động trong 30 giây**, không phải đọc docs mới bắt đầu.
- **Interactive scaffold**: `fx plugin new <name>` hỏi (1) **extension point** (driver · cell ·
  middleware · CLI command · dashboard panel · renderer · auth provider · **backend adapter**),
  (2) **loại** (TS module · WASM · native Go/Rust) → sinh đúng template cho lựa chọn đó.
- **Boilerplate đầy đủ, không trống rỗng**: `defineFluxeModule()` với **hook có kiểu pre-wired**
  + **một ví dụ chạy được** + **playground app nhúng** (`fx dev` thấy ngay) + **hot-reload** sẵn.
- **Kèm test + doc theo tenet T4**: scaffold sẵn **test** (gồm **conformance test** nếu là backend
  adapter — gắn mục 2) + **README/doc** + **API reference tự sinh từ type** → đúng "không xong nếu thiếu test+doc".
- **Sẵn sàng publish**: `package.json` exports + semver + **CI template**; `fx plugin publish` → registry (6e).
- **Vòng lặp DX hoàn chỉnh**: `fx plugin new x && cd x && fx dev` → thấy plugin sống trong
  playground + **panel dashboard** (4j) + lệnh `fx` của nó hoạt động. Sửa → hot-reload tức thì.
- **App-level generator** cùng cơ chế (gắn 4h): `fx gen cell|backend|job|migration|notification…`
  cũng sinh boilerplate + test + doc — nhất quán một bộ generator.

### Tài liệu rõ ràng (điều kiện sống còn của ecosystem)
- **Plugin authoring guide** đầy đủ + ví dụ chạy được + API reference tự sinh từ type.
- Mỗi extension point có **doc + template riêng**; **versioning policy** rõ để plugin không vỡ.
- Tham khảo chuẩn vàng: **VS Code** (API + marketplace), **Nuxt modules**, **Astro integrations**.

> Vì sao là payoff của cả tài liệu này: cùng cơ chế "interface + driver" cho phép switch
> backend (đã chứng minh), switch driver, switch transport… **cũng chính là cơ chế cho cộng
> đồng mở rộng**. Một mô hình → vừa là kiến trúc, vừa là hệ sinh thái. **fluxe thành platform,
> không chỉ framework.**

---

## 6f. Developer tooling — LSP, autocomplete, VS Code extension, CLI mở rộng  ⭐⭐⭐

Mở rộng ở tầng **editor/tooling** (khác plugin runtime 6e). Lợi thế gốc: fluxe **sở hữu
contract graph** (Resolution Plane) → một **fluxe Language Server** hiểu *cả app polyglot
như một đồ thị* → intelligence **xuyên TS↔Go↔Rust** mà không LSP đơn-ngôn-ngữ nào có.

### fluxe Language Server (LSP) — bộ não cho mọi editor
- **Editor-agnostic** (chuẩn LSP): viết một lần, chạy **VS Code · JetBrains · Neovim · Zed**.
- **★ Cross-language intelligence (chữ ký, chỉ fluxe có)**: từ `rpc("todos","add")` trong TS
  **nhảy thẳng** tới action trong service Go/Rust; **rename field contract → cập nhật TS+Go+Rust**;
  **find-references xuyên ngôn ngữ**. Sở hữu contract → làm được điều IDE thường bó tay ở biên ngôn ngữ.
- **Diagnostics thông minh**: lệch contract (TS gọi action Go đã xóa) · **secret lọt cell client**
  (4k) · route sai · thiếu migration (6b.H) — báo ngay trong editor.
- **Inline RCA / perf**: hover cell → thấy **6 trục giải** (language/location/render…); codelens
  "**0 JS**" / "**chạy ở Rust**" / p99 cạnh loader (gắn 4f/4i).

### Autocomplete cực tốt (hệ quả của type-safety, không phải vá thêm)
- **Typed-everything từ codegen contract** (mục 2): route, action, backend method, env key (4k),
  driver/topic channel (4g) — đều gợi ý đúng kiểu.
- **String API vẫn type-safe**: `rpc("cell","action")` an toàn nhờ **template literal types** +
  LSP → gõ là gợi ý cell/action hợp lệ, sai là báo đỏ.
- **tsserver plugin** tăng cường autocomplete sâu trên `defineCell`/`rpc`/`defineEnv`.

### VS Code extension (dựng trên LSP + GUI)
- Nhúng **dashboard** (4j) dạng webview · **command palette → lệnh `fx`** (4h) · scaffold cell/
  backend/migration · **bản đồ RCA Resolution** trực quan · run/debug cell · UI quản env (4k).
- **Extension API riêng** → cộng đồng viết thêm extension (linter, codegen, theme tooling).

### CLI mở rộng (gắn 4h + 6e)
- Lệnh `fx` **mở rộng được bởi plugin** (6e) → LSP/extension tự **phát hiện và surface** lệnh mới.
- `fx` xuất **JSON/LSP metadata** để editor và CI cùng đọc một nguồn.

> Vì sao đáng ⭐⭐⭐: autocomplete + cross-language navigation là thứ dev cảm nhận **mỗi phút**.
> fluxe biến contract graph (vốn để compiler giải RCA) thành **editor intelligence** — cùng
> một đồ thị phục vụ cả máy lẫn người. Tooling tuyệt vời = lý do dev ở lại.

---

## 7. Lộ trình đề xuất (thứ tự triển khai)

1. **Nền móng + DX dev** — routing, streaming SSR, HMR giữ state, hot reload polyglot,
   `fluxe dev` zero-setup, mutations chuẩn (Trục 4c — để dùng được thật & giữ chân dev).
2. **Codegen hợp đồng polyglot** (mục 2) — "wow" nhanh nhất, dựng trên contract đã có.
3. **Batteries-included** (mục 6b.A) — auth + tầng dữ liệu typed + admin auto, kèm
   **pipeline request: middleware chain + guard + RBAC/ABAC + JWT + rate-limit native**
   (mục 6b.F). Lý do #1 dev chọn framework; lấp khoảng trống lớn nhất của JS ecosystem
   trước khi Wasp chiếm.
4. **AI-native primitives** (mục 6b.C) — AI cell stream + tool-calling = action. Bắt sóng
   hạng mục hot nhất, dùng lại đúng cơ chế đã có.
5. **Compiler placement** (Trục 1) — wow kỹ thuật, whole-program analysis.
6. **Sync engine polyglot** (Trục 3) + **durable jobs** (mục 6b.B) — bet next-gen.
7. **Resumability** (Trục 2) + **single-binary deploy + auto-TLS** (Trục 4/4b) — đóng đinh khác biệt.
8. **Plugin/Module system + registry + docs** (mục 6e) — mở khóa network-effect; nên đặt
   extension point ổn định **sớm** để cộng đồng xây song song khi core còn phát triển.

> Đừng làm cả 4 trục cùng lúc. Trục 3 (local-first + sync engine Rust/Go) là thứ
> vừa hướng tương lai, vừa chỉ fluxe làm được tự nhiên nhờ kiến trúc polyglot.
> Plugin system (6e) là payoff cuối: biến fluxe từ framework thành **platform**.

---

## 8. PoC kế tiếp đáng làm

- **Codegen contract**: 1 schema → TS + Go + Rust types + adapter (chứng minh giá trị nhanh).
- **Sync engine tối giản** (Go hoặc Rust) sau interface `Backend`: client giữ state
  local, sync nền, UI cập nhật tức thời offline — chứng minh Trục 3 khả thi như đã
  chứng minh polyglot.
- **File-based routing + dynamic params**: nếu muốn "đủ dùng thật" trước.

---

## 9. Review tổng thể (2026-06) — khoảng trống & cảnh báo scope

> Doc đã phủ ~30 mảng (1200+ dòng). **Rủi ro lớn nhất giờ là scope, không phải thiếu ý
> tưởng.** Phần này: (A) khoảng trống chức năng thật còn thiếu, (B) cảnh báo scope + định
> nghĩa v0.1, (C) dọn dẹp tổ chức.

### A. Khoảng trống chức năng thật (nên bổ sung — đây là "đủ tốt" thiếu)
- **Testing story ⭐⭐⭐** (thiếu, mà fluxe có lợi thế lớn): unit/integration/E2E + **mock
  `Backend` cực dễ vì nó là interface** (chỉ cần memory backend) + component test cell +
  snapshot + `fx test`. Contract-test (6c) mới là một mảnh. Rails/Laravel mạnh nhờ test — fluxe phải có.
- **Forms + validation + progressive enhancement ⭐⭐**: pattern UI #1. Form chạy **kể cả
  khi chưa hydrate** (kiểu Remix), validate server surface về client, file upload. Mới chỉ
  nhắc "mutations" mỏng ở mục 4.
- **SEO / head / meta ⭐⭐**: ĐÃ có nền (PoC) — `cell.head(data)` → title/description/canonical/
  OG/JSON-LD bơm vào `<head>`; `/sitemap.xml` + `/robots.txt` tự sinh từ route table. Còn lại:
  hreflang (gắn 4p), structured-data helper phong phú hơn, per-route override nâng cao.
- **Public API / OpenAPI / webhooks ⭐⭐**: ngoài `rpc()` nội bộ — phơi REST/GraphQL có
  doc, **sinh OpenAPI**, API key + rate-limit cho bên thứ ba, webhook in/out, API versioning. SaaS cần.
- **Asset/media pipeline ⭐**: image optimization (responsive/format), fingerprint, CDN —
  đang để "table-stakes". Là feature bán hàng của Next, đừng quên.
- **i18n/l10n**: ĐÃ thiết kế ở **Trục 4p** (type-safe, polyglot, lazy). **a11y ⭐**: còn hoãn — giữ trong tầm ngắm.

### B. ⚠️ Cảnh báo scope — đây mới là điều quyết định "đạt được framework tốt"
- **Toàn bộ doc treo trên MỘT thứ chưa chứng minh: Resolver/compiler (Resolution Plane).**
  Hầu hết trục giả định nó chạy. Nếu Resolver không thành, RCA chỉ là file config. → **PoC
  Resolver là việc số 1**, trên cả mọi feature.
- **Làm tất cả = không bao giờ ship.** Doc là *tầm nhìn nhiều năm*, không phải scope v1.
- **Định nghĩa v0.1 (Minimal Lovable Product) — đề xuất:**
  1. `defineCell` + `defineContract` (Contract Plane) — đã có nền.
  2. Resolver giải **3 trục** thôi: Language (TS+Go) · Render (static/island) · Transport (in-proc/HTTP).
  3. SSR + island + **SPA nav** (đã gần đủ) + `fx dev` HMR.
  4. **1 driver thật mỗi loại**: memory + Postgres (data), `Backend` boundary (đã chứng minh Go/Rust).
  5. Auth tối thiểu + typed env (4k) + **debug bar (4l)** để "wow".
  6. **Testing (mock Backend)** — vì nó gần như free và bán được DX.
  → Đủ để dựng một app thật (todo/SaaS starter) **và** chứng minh thesis RCA. Mọi thứ khác = sau v0.1.
- **Nguyên tắc chống bloat (đã ghi ở Tầm nhìn) áp vào đây**: feature ngoài v0.1 → phải là
  **plugin (6e)**, không vào core.

### C. Dọn dẹp tổ chức (nhẹ, khi rảnh)
- **Lettering 6b lộn xộn**: thứ tự đang A·B·C·D·F·I·G·E·H — nên sắp lại hoặc bỏ chữ cái, dùng tên.
- **Trục 4b→4l phình**: gom theo nhóm (Deploy/Ops · DX · Runtime) để dễ đọc.
- **Thêm mục lục (TOC)** đầu doc — 1200 dòng cần điều hướng.

> Kết luận review: **ngừng thêm feature. Bắt đầu chứng minh Resolver + dựng v0.1.** Giá trị
> tiếp theo nằm ở code chạy được, như đã làm với polyglot Go/Rust — không phải idea thứ 31.
XX