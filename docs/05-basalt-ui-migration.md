# Basalt UI Migration Plan

Migrate Surety's visual design language to the Basalt template while preserving the Next.js framework, all business logic, data layer, API routes, auth, MCP server, and three-tier test suite.

## Source Template

- **Repo**: `../basalt` (Vite + React SPA, personal finance dashboard)
- **Design system**: Matte volcanic-rock aesthetic, 3-tier luminance hierarchy, HSL color tokens, Inter + DM Sans fonts
- **Login variant**: BadgeLogin (vertical badge-card with barcode header)
- **Primary color**: Vermilion (`15 85% 52%` light / `15 85% 57%` dark)

---

## 1. Cleanup — Remove Unused Components & Dependencies

### Unused shadcn/ui components (0 imports each)

| Component | File |
|-----------|------|
| calendar | `src/components/ui/calendar.tsx` |
| form | `src/components/ui/form.tsx` |
| popover | `src/components/ui/popover.tsx` |
| scroll-area | `src/components/ui/scroll-area.tsx` |
| toggle | `src/components/ui/toggle.tsx` |

### Unused npm dependencies

| Package | Reason |
|---------|--------|
| `react-hook-form` | No files import it |
| `@hookform/resolvers` | Depends on react-hook-form |
| `react-day-picker` | Only used by deleted calendar component |

---

## 2. CSS Design Token Replacement

Replace `globals.css` entirely. Key changes:

| Aspect | Current (Surety) | Target (Basalt) |
|--------|-------------------|-----------------|
| Color space | oklch | HSL |
| CSS import | `@import "shadcn/tailwind.css"` | Manual token mapping |
| Luminance | Flat (card = background = white) | **3-tier**: L0 body > L1 card > L2 secondary |
| Primary | 5 switchable themes (oklch) | Fixed Vermilion HSL |
| Chart palette | 8 colors | 24 sequential colors |
| Radius tokens | `--radius` only | `--radius-card: 14px`, `--radius-widget: 10px` |
| Utility tokens | None | `--chart-axis`, `--chart-muted` |

### 3-Tier Luminance Hierarchy

| Tier | Purpose | Light | Dark |
|------|---------|-------|------|
| L0 `--background` | Body | `220 14% 94%` | `0 0% 9%` (#171717) |
| L1 `--card` | Content panels | `220 14% 97%` | `0 0% 10.6%` (#1b1b1b) |
| L2 `--secondary` | Inner cards/widgets | `0 0% 100%` | `0 0% 12.2%` (#1f1f1f) |

### Vermilion Primary

| Mode | HSL Value |
|------|-----------|
| Light | `15 85% 52%` |
| Dark | `15 85% 57%` |

---

## 3. Font Replacement

| Current | Target |
|---------|--------|
| Geist Sans / Geist Mono (Next.js built-in) | Inter (body) + DM Sans (display/numbers) |

- Load via Google Fonts in `layout.tsx`
- Add `@utility font-display { font-family: "DM Sans", system-ui, sans-serif; }` in CSS
- Apply `font-display` class to metric numbers and headings

---

## 4. Chart Color Palette

Import basalt's `palette.ts` with 24-color system:

```
chart-1  (primary/blue) → chart-8  (orange)  → chart-12 (magenta)
chart-13 (orchid)       → chart-18 (cadet)   → chart-24 (gray)
```

Includes semantic aliases:
- `chartPositive` = green
- `chartNegative` = destructive red
- `chartPrimary` = brand (vermilion in our case)
- `chartAxis` / `chartMuted` utility tokens

---

## 5. Layout Shell (AppShell) Rewrite

### Current
```
┌─────────┬──────────────────────────┐
│ sidebar  │ header (border-b)        │
│ border-r │──────────────────────────│
│          │ main (flat bg-background)│
└─────────┴──────────────────────────┘
```

### Target (Basalt "floating island")
```
┌─────────┬──────────────────────────┐
│ sidebar  │ header (no border)       │
│ no       │──────────────────────────│
│ border   │ ┌──────────────────────┐ │
│          │ │ rounded-[20px]       │ │
│          │ │ bg-card p-5          │ │
│          │ │ (content here)       │ │
│          │ └──────────────────────┘ │
└─────────┴──────────────────────────┘
```

Key changes:
- Header: remove `border-b`, keep `h-14`
- Main wrapper: `flex-1 px-2 pb-2 md:px-3 md:pb-3`
- Inner container: `rounded-[16px] md:rounded-[20px] bg-card p-3 md:p-5 overflow-y-auto`

---

## 6. Sidebar Visual Rewrite

**Preserve**: 8 nav items, collapse/expand, user avatar, sign-out, logo.

| Aspect | Current | Target |
|--------|---------|--------|
| Background | `bg-sidebar border-r` | `bg-background` (no border) |
| Nav item | `rounded-md` | `rounded-lg` |
| Icon stroke | default (2) | `strokeWidth={1.5}` |
| Width | 256px / 64px | 260px / 68px |
| Mobile | Not implemented | Overlay with `bg-black/50 backdrop-blur-xs` |

**New feature**: Command palette search (Cmd+K) via `cmdk` package.

---

## 7. Login Page → BadgeLogin

Replace the current simple Card login with basalt's BadgeLoginPage design:

- Vertical badge card (54:86 aspect ratio)
- Vermilion header strip with barcode pattern + logo
- Avatar placeholder area
- "Welcome" / "Sign in to get your badge" text
- Google sign-in button (retains real NextAuth `signIn()`)
- Error message display (retains current logic)
- Footer strip with "Secure authentication" indicator
- Radial glow background effect
- Brand text: "surety" (replaces "basalt")

---

## 8. Dashboard Page Styling

| Aspect | Current | Target |
|--------|---------|--------|
| Card style | `bg-card rounded-lg border shadow-sm` | `bg-secondary rounded-card border-0 shadow-none` |
| Chart colors | 8-color chart-config | 24-color palette.ts |
| Numbers font | default | `font-display` (DM Sans) |
| Card header icon | default stroke | `strokeWidth={1.5}` |

---

## 9. Data Table Pages (members/policies/assets/insurers)

- Table: adjust border-radius, spacing to match basalt Card pattern
- Sheet (slide-out forms): input fields use `rounded-widget border-border bg-card`
- Buttons: `rounded-widget bg-primary px-4 py-2.5 text-sm font-medium`
- Retain all CRUD functionality, sorting, filtering, grouping

---

## 10. Settings Page Adjustments

- **Remove**: 5-color theme picker (replaced by fixed Vermilion primary)
- **Retain**: Family finance settings, reminder settings, backup/restore, MCP toggle
- Style alignment with basalt form/input patterns

---

## 11. Mobile Adaptation

- Add `useIsMobile()` hook (768px breakpoint)
- Mobile sidebar: overlay drawer with `bg-black/50 backdrop-blur-xs` backdrop
- Hamburger menu button in header (mobile only)
- Body scroll lock when sidebar is open

---

## 12. Dependency Changes

| Action | Package | Reason |
|--------|---------|--------|
| Install | `cmdk` | Command palette (Cmd+K search) |
| Remove | `react-hook-form` | Unused |
| Remove | `@hookform/resolvers` | Unused |
| Remove | `react-day-picker` | Unused (calendar deleted) |

---

## 13. components.json Update

```json
{
  "style": "default",
  "baseColor": "slate",
  "rsc": true
}
```

Only affects future `shadcn add` commands. Existing component files follow CSS variables automatically.

---

## Zero Functionality Loss Guarantee

| Feature | Impact | Measure |
|---------|--------|---------|
| NextAuth login | UI only | signIn/signOut calls unchanged |
| CRUD forms (Sheet) | Style only | Form logic, API calls unchanged |
| Data tables + sort/filter | Style only | Table component logic unchanged |
| Dashboard charts | Color system swap | Recharts data flow unchanged |
| 5-color theme → Vermilion | **Feature removal** | Settings page theme picker removed |
| DB Selector | Style only | Minor style adjustment |
| MCP Server | No impact | Pure backend logic |
| Backup/Restore | Style only | Minor style adjustment |

---

## Test Impact

| Tier | Impact | Action |
|------|--------|--------|
| UT (`bun test`) | Low — tests DB/VM pure logic | Verify pass |
| Lint (`eslint`) | Medium — new/deleted files | Clean imports, verify zero errors |
| E2E (HTTP tests) | Low — tests API data correctness | Verify pass |

---

## Execution Order (Atomic Commits)

1. Delete 5 unused shadcn components + 3 unused dependencies
2. Replace `globals.css` — HSL tokens + 3-tier luminance + Vermilion primary + 24-color palette
3. Replace font system (Inter + DM Sans)
4. Import `palette.ts` + `withAlpha` utility
5. Rewrite AppShell layout (floating island container)
6. Rewrite Sidebar visual
7. Replace Login page with BadgeLogin
8. Dashboard page styling
9. Data table pages styling (members/policies/assets/insurers)
10. Remaining pages styling (coverage-lookup/renewal-calendar/settings)
11. Settings page: remove multi-color theme picker
12. Mobile adaptation
13. Full test verification (UT + Lint + E2E)
