# Bidly — demo app chứng minh fluxe (design)

> Mục tiêu: chứng minh fluxe hoạt động tốt với **rất ít code**, **không API REST truyền thống**
> (chỉ contract + `/__rpc`), **tái dùng view template**, tận dụng React FE. Tính năng thiếu →
> rút/nâng vào **fluxe core** dần (đo được mỗi lần). Sàn đấu giá realtime.

## Ranh giới (đúng triết lý: fluxe = cầu nối RCA, host lo cross-cutting)

```
app/backend/server.ts (Express — host)
  ├─ better-auth handler @ /api/auth/*            ← provider lo password/session
  ├─ bridgeSession(better-auth) → req.session     ← @nmvuong92/fluxe/auth, mount TRƯỚC fluxe
  ├─ bullmq queue + worker (redis)                ← HOST lo job; worker publish về broker fluxe
  └─ fluxe(manifest, cells, layouts, { contract, resolvers, backend })  ← core: CRUD+realtime+SSR
```

## Domain
- **User** (better-auth sở hữu bảng user/session): role `seller | bidder | admin`.
- **Lot**: `{ id, title, description, startPrice, currentPrice, currentLeader?, status: "live"|"sold"|"cancelled", endsAt, sellerId }`.
- **Bid**: `{ id, lotId, bidderId, amount, at }`.

## Map yếu tố → tầng
| Yếu tố | fluxe | Chi tiết |
|---|---|---|
| CRUD | core | `f.query/mutation` + resolvers + `node:sqlite`. Không REST tay. |
| Auth | integration | better-auth → `bridgeSession`; op `{auth:"seller"}`; cell `requireRole`; `useSession()` |
| Realtime giá | core (SSE) | `f.subscription` topic `lot:<id>`; `placeBid` → `ctx.publish` |
| Notification 🔔 | core (SSE) | `f.subscription` topic `notif:<userId>`; outbid → publish |
| Job queue | HOST | bullmq+redis: `closeLot` delayed tới `endsAt` → publish "sold" + enqueue email |

## Contract (app/contract.ts)
```
Lot, Bid (f.object)
lots:      f.query(Lot.array())
lot:       f.query(Lot)                                  // (input: id — xem ghi chú typed-input)
createLot: f.mutation({title,description,startPrice,endsAt}, Lot, {auth:"seller"})
closeLot:  f.mutation({id}, Lot, {auth:"admin"})
placeBid:  f.mutation({lotId,amount}, Bid, {auth:"bidder"})
lotFeed:   f.subscription(Lot)                            // topic lot:<id>
notifFeed: f.subscription(Notif)                          // topic notif:<me>
```
> Ghi chú: query hiện chưa nhận input (chỉ output). `lot(id)` cần input → **rút lên core**:
> mở rộng `f.query(input?, output)` để query có input typed (cải thiện core, Phase 2).

## Cells
| Route | Hydration | Nội dung | Reuse |
|---|---|---|---|
| `/` | static | landing i18n | — |
| `/lots` | island | `api.lots.useQuery()` → bảng | `<DataTable>` |
| `/lots/[id]` | island | live bids (`useSubscription`) + đặt giá (`useForm`) + countdown | `<BidForm>`, `useCountdown` |
| `/lots/new` | island | tạo lot (seller, guard) | `<ResourceForm>` |
| `/sign-in`·`/sign-up` | island | form → better-auth | — |

Bell 🔔 trong layout `site`: `api.notifFeed.useSubscription` → toast + đếm.

## "Vừa build vừa rút lên core" (đo được)
Khi pattern lặp lần 2 → rút lên `@nmvuong92/fluxe/react` + release minor:
1. `<DataTable rows columns>` (list từ useQuery) — sau `/lots`.
2. `<ResourceForm>`/`<Field>` (form từ useForm + field map) — sau khi `/lots/new` + bid form lặp.
3. `f.query` có **input typed** (cho `lot(id)`) — nâng contract core.
4. (nếu cần) `useCountdown(endsAt)`.

## Thứ tự phase (mỗi phase: chạy được + `npm run test:all` xanh)
1. **Infra**: deps (`better-auth bullmq ioredis`); sqlite schema lots/bids; better-auth wire + bridgeSession; role seed.
2. **CRUD lots**: contract lots/createLot + resolvers + `/lots` + `/lots/new`. Rút `<DataTable>`/`<ResourceForm>`.
3. **Realtime bids**: `placeBid` + `lotFeed` + `/lots/[id]` live + optimistic.
4. **Notification**: `notifFeed` + bell.
5. **Jobs**: bullmq `closeLot` đúng `endsAt` → publish sold + winner email worker.
6. **Bonus**: span waterfall trên `placeBid` (đã có), i18n, polish.

## Prerequisite
- Cài: `better-auth bullmq ioredis`.
- **Redis chạy** cho bullmq (`docker run -p 6379:6379 redis` / `brew services start redis`). Phase 5
  kiểm tra; không có → báo user bật, hoặc fallback `pg-boss`/in-process (user quyết).

## Ràng buộc giữ nguyên
- Mọi import `@nmvuong92/fluxe*` (không lộ `src/`). View 2-file (view.tsx + index.tsx). Hydration island mặc định.
- Core mới → ENV `FLUXE_*` + docs + test. Mỗi nâng core = release minor.
- Commit tác giả nmvuong92. Demo app (`app/`) không cần release; nâng core (`src/`) thì release.
