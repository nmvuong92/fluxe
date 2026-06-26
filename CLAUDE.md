# CLAUDE.md — quy tắc làm việc trong repo fluxe

## Quy tắc DSA / tối ưu (BẮT BUỘC khi đụng code hot-path hoặc core)

Khi viết/sửa code — **nhất là `src/core/*`, runtime, hoặc đường nóng (per-request, vòng lặp,
realtime, parsing)** — phải:

1. **Nghiên cứu kỹ DSA/thuật toán TRƯỚC khi implement.** Hỏi: cấu trúc/thuật toán nào tối ưu
   cho thao tác chính ở đây? Độ phức tạp hiện tại là gì (O(n)? O(n²)? rò RAM?).
2. **Chỉ áp DS khi sửa một điểm dở ĐO ĐƯỢC** — không cargo-cult, không thêm cho đủ bộ.
   Tín hiệu đáng tối ưu: O(n)/O(n²) trên hot-path · `Array.shift/unshift` trong vòng lặp ·
   `Map`/cache không bound (rò RAM) · scan tuyến tính chỗ cần O(1)/O(log n) · re-parse/re-alloc mỗi request.
3. **ĐO, đừng đoán** (tenet idea.md §4f): chứng minh cải thiện bằng **micro-benchmark hoặc test
   số liệu** (vd "4.3× nhanh hơn", "size ≤ maxKeys"). Không có số → không nhận là tối ưu.
4. **KHÔNG break logic framework**: tối ưu phải **behavior-preserving** — output/test giữ nguyên.
   Sau mỗi thay đổi chạy `npm run test:all` (typecheck + 112 unit + 30 integration) **phải xanh**.
5. Tối ưu **lõi compiled** (Go/Rust) thuộc về đúng tầng (§6d); ở TS giữ đúng-đắn + cấu trúc đúng.

### Bảng tra DSA → ứng dụng backend (ứng viên khi gặp tín hiệu trên)

| Cần gì | Dùng | Đã áp trong fluxe |
|--------|------|--------------------|
| Lookup/cache/session/dedup O(1) | **Hash Table** (Map/Set) | wiring, broker, presence, resolver |
| Log/stream vòng, ghi O(1) | **Ring Buffer** | `observe.ts` (4.3× vs push/shift) |
| Cache/bucket bound bộ nhớ | **LRU Cache** | `ratelimit.ts` (chống rò RAM theo IP) |
| Route nhiều/động nhanh | **Trie / Radix tree** | *router.ts còn linear — nâng khi nhiều route* |
| Top-K / scheduler / priority | **Heap / Priority Queue** | — |
| Job nền, retry, fan-out | **Queue** | `jobs.ts` (SQLite, dead-letter) |
| "Đã thấy chưa?" rẻ (dedup/rate) | **Bloom / Cuckoo filter** | — (idea.md 6b.G) |
| Đếm unique / tần suất xấp xỉ | **HyperLogLog / Count-Min** | — (idea.md 6b.G) |
| Shard distributed ổn định | **Consistent Hash** | — (khi scale 4d) |
| Tìm/sort/pagination | **Binary Search · Merge/Quick sort** | — |
| Dependency/workflow thứ tự | **Topological Sort** | — (jobs/pipeline tương lai) |
| Rate-limit / log cửa sổ | **Sliding Window** | (token-bucket hiện đủ) |
| Cây danh mục/menu/quyền | **Tree + BFS/DFS** | layoutChain (DFS chuỗi) |

> Ưu tiên thực dụng (idea.md): Hash Table · Queue · LRU · Ring Buffer · Heap · Trie ·
> Bloom/HLL · Binary Search · BFS/DFS · Topological Sort. Bỏ qua AVL/Fibonacci Heap/Segment Tree
> trừ khi có nhu cầu đo được.

## Kiểm thử (tenet T4)
- `npm run test:all` = typecheck + unit + integration — gate trước khi coi là "xong".
- Mọi feature/optimize ship kèm test (mock `Backend` rất dễ — `src/core/testing.ts`).

## Ranh giới (đừng phá)
- `app/` = dev sở hữu; `src/` = engine không đụng; `app/native/` = service Go/Rust.
- "Backend nào chạy" do `app/profiles.ts` (config), **không** do vị trí folder.
