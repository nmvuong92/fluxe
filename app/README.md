# app/ — code CỦA BẠN (fluxe engine ở `src/` không đụng)

Tách 2 nửa, folder + alias (`@backend/*`, `@frontend/*`), **feature-module**, 0 monorepo tool.

```
app/
  backend/                     # API + data + nghiệp vụ
    db.ts                      # driver data (memory|sqlite|postgres) — export makeDb()
    env.ts                     # env
    contract.ts                # static spread contract các module (type cho client)
    app.ts                     # makeApp() = createApp({ plugins })
    server.ts                  # entry Fastify|Express mount fluxe (catch-all)
    modules/<feature>/         # 1 feature = 1 local plugin
      <feature>.data.ts        #   (tuỳ chọn) interface/driver riêng
      <feature>.service.ts     #   nghiệp vụ thuần
      <feature>.contract.ts    #   f.query/mutation/subscription
      <feature>.resolvers.ts   #   handler
      <feature>.plugin.ts      #   definePlugin gói lại
    tests/                     # VÙNG TEST RIÊNG
      unit/  e2e/  helpers/  fixtures/
  frontend/                    # cells + UI
    features/<feature>/        # 1 feature = cell(s)
      <name>.cell.tsx          #   route + loader (server)
      <name>.view.tsx          #   giao diện thuần (client)
    layouts/  components/      # layout + UI dùng chung
    i18n.ts  api.ts  profiles.ts
    registry.ts  views.ts      # SINH bởi fx sync (gitignore) — cells + views
```

## Quy tắc

- **Thêm feature backend:** tạo `app/backend/modules/<x>/`, export `definePlugin`, thêm vào `plugins` trong `app.ts`.
- **Thêm trang:** `fx new <feature>/<name>` → sinh `<name>.cell.tsx` + `<name>.view.tsx`, tự `fx sync`.
- **Đổi nơi lưu:** thay `app/backend/db.ts` (driver), module không đổi.
- **cell.id === basename** của `<name>.cell.tsx`.
- Cell 2-file: `view.tsx` phải `export default` (client bundle import); `cell.tsx` = `defineCell`.
