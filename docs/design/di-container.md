# Thiết kế: Resolved Container — DI + bootstrap lười

> Mục tiêu: DI cực linh hoạt; **chỉ module được dùng mới bootstrap** (lazy); mở rộng rộng rãi;
> nền cho lazy-cell + code-split. Hợp triết lý RCA: service cũng là thứ được *resolve* lười.

## 1. Kỹ thuật tham khảo (ngành)
- **Lazy memoized singleton** (Laravel `singleton`, Angular `providedIn`): register factory →
  instantiate lần đầu `get` → cache. Chỉ-used-mới-tạo.
- **Factory resolve deps** (Spring/Inversify): factory gọi `c.get(dep)` → DI; thứ tự init = DFS tự nhiên.
- **Cycle detection**: DFS + tập "đang giải" → ném khi gặp lại.
- **Lazy code load**: ESM `import()` (webpack/vite code-split) → defer JS tới khi dùng.
- **Radix/trie router**: O(k) match khi nhiều route.

## 2. Phân tích trung thực (perf nằm ở đâu)
- Service fluxe hiện rẻ (toàn `Map`) → lazy chúng là **clean-arch + chỉ-used-bootstrap**, KHÔNG
  phải win perf lớn.
- Win perf THẬT: **lazy cell code-load** (cold-boot không import hết cell) + **client code-split**
  (chỉ tải JS island đang xem). Là phase sau (đụng sync/bundle nhiều).

## 3. API Container (THUẦN, testable)
```ts
interface Container {
  register<T>(token: string, factory: (c: Container) => T): Container; // O(1), 0 instantiate
  get<T>(token: string): T;          // lazy + memoize + cycle-safe (DFS)
  has(token: string): boolean;
  resolved(): string[];              // token ĐÃ tạo → "chỉ used mới bootstrap" + observability
  override<T>(token, factory): Container; // ghi đè (test/config)
}
createContainer(): Container
```
DSA: `Map<token,factory>` + `Map<token,instance>` (O(1)); `Set` "đang giải" (cycle, O(depth)).

## 4. Áp vào engine (phase 1 — làm now)
- `makeServer` tạo 1 Container, **register** service nặng/optional dưới dạng factory:
  `broker`, `presence`, `jobs`(SQLite), `storage`(disk). KHÔNG tạo cho tới khi request đầu cần.
- App không dùng realtime → broker không bao giờ tạo; không upload → storage không mở. `resolved()`
  chứng minh điều đó (expose ở `/_fluxe`).
- Service rẻ luôn-dùng (recorder/renderCache/ratelimit) có thể giữ eager hoặc cũng register — tuỳ.

## 5. Phase sau (thiết kế sẵn)
- **Lazy cell**: registry `route → () => import("./cells/x")`; load cell lần đầu route bị hit,
  cache. Router radix-trie O(k). → cold-boot không import hết cell.
- **Client code-split**: esbuild `--splitting` + dynamic `import()` per island → browser chỉ tải
  chunk island đang xem.

## 6. Phi mục tiêu (phase 1)
- Chưa transient/request-scope (chỉ singleton lười).
- Chưa lazy-cell/code-split (phase sau).
- Không over-engineer service rẻ thành DI nếu không cần — thực dụng (idea.md).
