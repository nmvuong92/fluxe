# Thiết kế: Kiến trúc Layout / Theme / i18n / Navigation cho fluxe

> Mục tiêu: layout dễ dùng, dễ customize, có master template + theme + i18n + navigation mạnh,
> DX tốt nhất, và `fx init` cho ra **default template đẹp, kiến trúc tốt** ngay.

## 1. Tham khảo top framework (chắt lọc)

| FW | Layout | Theme | i18n | Nav |
|----|--------|-------|------|-----|
| **Next App Router** | `layout.tsx` lồng theo segment, compose | next-themes (CSS var + `data-theme`, no-flash script) | next-intl / `[locale]` segment + middleware | `<Link>` + `usePathname` active |
| **Astro** | `layouts/` + `<slot/>` | CSS var + class | routing `[lang]/` built-in (Astro 4) | component |
| **SvelteKit** | `+layout.svelte` lồng + `<slot/>`, `+layout.ts` load | lib | lib (paraglide…) | `$page.url` active |
| **Nuxt** | `layouts/` named + `<NuxtLayout>` | @nuxtjs/color-mode | **@nuxtjs/i18n** (rất mạnh) | `<NuxtLink>` active |

**Nguyên tắc tốt nhất rút ra:**
1. **Layout lồng & compose** (master → nested), slot children. fluxe đã có `layoutChain` (nested qua `parent`).
2. **Theme = CSS variables + `data-theme` trên `<html>`**, persist (cookie/localStorage), **no-flash** (set trước paint bằng inline script).
3. **i18n = catalog message + `t(key)`**, locale resolve (URL prefix / cookie / header), **SSR-aware** (render đúng ngôn ngữ, không flash).
4. **Nav = config khai báo (menu tree) → component render**, active theo path hiện tại, breadcrumb từ route.
5. **Default template** init sẵn: master layout (header+nav+theme+locale+footer), vài trang, design tokens đẹp.

## 2. Kiến trúc fluxe (mới mẻ: "Resolved Shell")

Triết lý RCA: layout/theme/locale cũng là **trục được giải**. Gom thành **Shell** — vỏ bọc quanh cell,
resolve từ context (cookie/url) ở server, không cần cell biết.

```
request → resolve Shell context { theme, locale, path }  (đọc cookie/url, server)
        → layoutChain(cell.layout) bọc view, layout nhận ctx
        → <html data-theme> + <head> no-flash script + lang
```

### 2a. Layout (đã có, chuẩn hoá)
- `app/layouts/index.tsx`: map id → `{ id, parent?, component }`. Master = layout gốc (không parent).
- Layout component nhận `{ children, ctx }` với `ctx = { theme, locale, path, t }`.
- Compose: `layoutChain(cell.layout)` inner→outer (đã chạy).

### 2b. Theme (CSS var + data-theme, no-flash, KHÔNG cần engine đổi)
- `app/theme.css`: `:root { --bg, --fg, --accent… }` + `[data-theme="dark"] { … }`.
- **No-flash**: inline script trong `<head>` (chạy trước paint) đọc `localStorage.theme || matchMedia` → set `document.documentElement.dataset.theme`. → SSR không cần biết theme, vẫn 0 nháy.
- `useTheme()` hook + `<ThemeToggle/>` (set dataset + localStorage). Persist localStorage.
- *(Nâng cao sau: đọc cookie ở server để `data-theme` đúng ngay trong HTML SSR — cần engine ctx.)*

### 2c. i18n (catalog + t(), SSR-aware)
- `app/i18n/{en,vi}.ts`: `export default { "home.title": "…" }`.
- Locale resolve: cookie `locale` (hoặc URL `/vi/…`). Server đọc → chọn catalog → `t(key)` đưa vào loader/view qua ctx.
- `t(key, vars)` thuần (interpolate `{name}`). `<LocaleSwitch/>` set cookie + reload/SPA-nav.
- SSR render đúng ngôn ngữ (locale ở cookie → 0 flash). *(Cần engine: truyền ctx vào loader/layout.)*

### 2d. Navigation (config khai báo + active)
- `app/nav.ts`: `export const nav = [{ label, href }, …]` (menu tree).
- `<Nav/>` render từ config, **active** theo path hiện tại (`aria-current`). Path: client có `location`; SSR cần ctx.path.
- Breadcrumb (tương lai) sinh từ route table.

## 3. Default template (fx init) — cái thấy được ngay

`fx init` (hoặc `fx init --template starter`) sinh:
- `app/theme.css` (design tokens: màu, spacing, radius, font) + dark mode.
- `app/layouts/index.tsx`: **master layout** = `<header>` (logo + `<Nav/>` + `<ThemeToggle/>`) + `{children}` + `<footer>`; DebugBar.
- `app/nav.ts`: menu mặc định (Home, About).
- `app/cells/home`, `app/cells/about`: 2 trang static đẹp.
- `src/react`: `useTheme`, `<ThemeToggle/>`, `<Nav/>` (engine cung cấp, app dùng).
- No-flash script + `theme.css` nhúng vào shell `<head>`.

→ `fx init && npm run dev` ra ngay một site có header/nav/footer, dark mode, đẹp — không cần dựng tay.

## 4. Lộ trình (giảm rủi ro, từng phần test được)
1. **Theme client-side** (CSS var + no-flash + useTheme/ThemeToggle) — KHÔNG đụng engine. ⟵ làm trước.
2. **Nav config + `<Nav/>`** active (client-side highlight sau hydrate, hoặc ctx.path).
3. **Default template** trong `fx init` (master layout + theme + nav + tokens).
4. **i18n** (catalog + t() + locale cookie) — cần engine truyền ctx vào loader/layout (bước riêng).
5. **Resolved Shell ctx** (server đọc cookie theme/locale → SSR đúng ngay, no-flash cả theme) — engine.

## 5. Phi mục tiêu
- Không build CMS/visual builder.
- i18n bản đầu: chỉ key-value + interpolate, chưa plural/format phức tạp.
- Theme: chưa theme-editor; chỉ light/dark + tokens sửa tay.
