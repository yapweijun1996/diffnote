# DiffNote — Design System (SSOT)

This is the single source of truth for DiffNote's UI/UX. All styling decisions
trace back to a token here. If a value isn't in this file, it doesn't belong in
the CSS.

---

## 1. Product & Personality

DiffNote is a **local-first developer tool** for comparing two versions of a
file. The personality is **calm, precise, content-first** — the diff is the
hero; chrome stays quiet.

- **Audience:** developers reviewing changes, writing commit messages.
- **Tone:** trustworthy (local-first, nothing leaves the browser), efficient,
  uncluttered.

## 2. Aesthetic Direction — Apple-inspired

Following Apple Human Interface principles:

- **Clarity** — generous whitespace, strong hierarchy, no decorative noise.
- **Deference** — neutral surfaces; color is reserved for meaning (diff +/−,
  the single system-blue accent for primary actions).
- **Depth** — soft, low elevation (subtle shadows + hairline borders), never
  heavy drop shadows.
- **Restraint** — one accent color, rounded corners, light by default.

## 3. Layout — Admin Shell

Three-region application shell:

```
┌────────────────────────────────────────────────────┐
│ TOPBAR  brand · theme toggle · notes toggle · reset  │
├──────────┬──────────────────────────┬────────────────┤
│ SIDEBAR  │ CONTENT                  │ INSPECTOR      │
│ Before   │ Visual diff (full width) │ Change Notes   │
│ After    │ + stats                  │ (toggleable)   │
│ options  │                          │                │
└──────────┴──────────────────────────┴────────────────┘
```

- **Topbar** (`--topbar-h: 56px`): brand left; actions right (theme toggle,
  notes toggle, reset). Sticky.
- **Sidebar** (`--sidebar-w: 300px`): the Before/After file inputs + stats live
  here so the sidebar *earns its space* (not empty nav). Collapses to a drawer
  below the `md` breakpoint.
- **Content**: the diff viewer gets full content width (it is width-hungry,
  more so once split-view lands in Epic 3).
- **Inspector** (`--inspector-w: 360px`): Change Notes panel, toggleable; open
  by default on `lg+`, overlay drawer on narrow screens.

## 4. Color System

Driven by `[data-theme]` on `<html>`. **Default is light**; dark is opt-in via
toggle and persisted — we do NOT auto-follow `prefers-color-scheme`.

Semantic tokens (resolve to theme-specific raw values):

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#f5f5f7` | `#1d1d1f` | app background |
| `--surface` | `#ffffff` | `#2c2c2e` | cards, panels, topbar |
| `--surface-2` | `#f0f0f3` | `#3a3a3c` | inset / hover |
| `--border` | `rgba(0,0,0,.10)` | `rgba(255,255,255,.12)` | hairlines |
| `--text` | `#1d1d1f` | `#f5f5f7` | primary text |
| `--text-muted` | `#6e6e73` | `#98989d` | secondary text |
| `--accent` | `#0066cc` | `#0060c8` | primary fill (button bg), focus ring — white text passes AA |
| `--accent-text` | `#0066cc` | `#5cabff` | accent-colored *text* (headings/brand) — passes AA on surface |
| `--accent-contrast` | `#ffffff` | `#ffffff` | text on accent fill |
| `--added-bg` | `#e3f9e5` | `rgba(48,209,88,.16)` | added diff row |
| `--added-fg` | `#1a7f37` | `#30d158` | added marker |
| `--deleted-bg` | `#ffebe9` | `rgba(255,69,58,.16)` | deleted diff row |
| `--deleted-fg` | `#cf222e` | `#ff453a` | deleted marker |

**Contrast:** body/muted text must meet WCAG AA (≥4.5:1) in both themes.

## 5. Typography

Apple system font stack; SF Mono for code.

- `--font-sans`: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- `--font-mono`: `ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace`

Type scale (rem):

| Token | Size | Use |
|---|---|---|
| `--text-xs` | 0.75rem (12px) | labels, badges, line numbers |
| `--text-sm` | 0.8125rem (13px) | secondary, captions |
| `--text-base` | 0.875rem (14px) | body, UI |
| `--text-lg` | 1.0625rem (17px) | section titles |
| `--text-xl` | 1.3125rem (21px) | brand / page title |

Weights: 400 body, 500 medium (labels), 600 semibold (titles).
Line-height: 1.5 body, 1.45 code.

## 6. Spacing System

4px base scale — never hardcode pixels in components.

| Token | px |
|---|---|
| `--space-1` | 4 |
| `--space-2` | 8 |
| `--space-3` | 12 |
| `--space-4` | 16 |
| `--space-5` | 24 |
| `--space-6` | 32 |
| `--space-7` | 48 |

## 7. Radius & Elevation

- `--radius-sm`: 6px (controls) · `--radius-md`: 10px (cards) · `--radius-lg`: 14px (containers)
- `--shadow-sm`: `0 1px 2px rgba(0,0,0,.06)`
- `--shadow-md`: `0 4px 16px rgba(0,0,0,.08)` (overlays/drawers only)
- Pill toggle uses full radius.

## 8. Components

- **Button (default)**: `--surface-2` bg, hairline border, `--radius-sm`, hover lightens.
- **Button (primary)**: `--accent` bg, `--accent-contrast` text.
- **Icon button**: square, transparent, hover `--surface-2`. Used in topbar.
- **Dropzone**: dashed `--border`, `--radius-md`; `has-file` → solid + accent; `has-error` → deleted-fg border + message.
- **Theme toggle**: icon button, sun (light) / moon (dark).
- **Diff row**: monospace table; before/after line-number columns; marker column; added/deleted bg tokens.
- **Inspector section**: `--text-xs` uppercase accent heading + body.
- **Badge**: `--surface-2`, `--text-xs`, pill.

## 9. Motion

Subtle and quick; Apple ease.

- `--ease`: `cubic-bezier(.4, 0, .2, 1)`
- `--dur-fast`: 120ms (hover/feedback) · `--dur-base`: 220ms (drawers/panels)
- Always wrap non-essential motion in `@media (prefers-reduced-motion: reduce)` → none.

## 10. States

- **Empty**: friendly instruction in the content area before both files load.
- **Error**: in-dropzone message (file unreadable / too large), `has-error` styling.
- **Success/feedback**: copy button → "Copied ✓" for 1.5s.
- **Focus**: visible 2px `--accent` ring via `:focus-visible` on all interactive elements.
- (Loading state reserved — diff is instant for MVP sizes.)

## 11. Breakpoints

| Name | Min width | Behavior |
|---|---|---|
| base | 0 | single column; sidebar + inspector are drawers/overlays |
| `md` | 768px | sidebar docked; inspector toggled overlay |
| `lg` | 1100px | sidebar + content + inspector all docked |

## 12. PWA Behavior — "Always Latest"

DiffNote must never serve stale code while staying installable/offline.

- **Service worker = network-first** for all GET requests: try network, fall
  back to cache only when offline. This guarantees the latest source on every
  online load (the real fix for "force auto reload latest").
- **Auto-update**: new SW calls `skipWaiting()` + `clients.claim()`; the page
  listens for `controllerchange` and reloads **once** (guarded against loops,
  and only armed when a controller already existed at startup).
- Manifest: `display: standalone`, light `theme_color`/`background_color`,
  192 + 512 maskable icons.

## 13. Accessibility

- AA contrast (≥4.5:1) for text in both themes.
- `:focus-visible` ring on every interactive element.
- Drawers/toggles reflect state via `aria-expanded` / `aria-pressed`.
- `prefers-reduced-motion` respected.
- Keyboard: dropzones focusable + Enter/Space activate; toggles are real buttons.
