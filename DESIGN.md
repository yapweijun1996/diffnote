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

Two-region application shell, preceded by a startup gate (inputs only until both
files load):

```
┌──────────────────────────────────────────────────────────────────┐
│ TOPBAR  brand · language · reset · notes · settings · theme        │
├────────────────────────────────────┬─────────────────────────────┤
│ CONTENT                            │ INSPECTOR                   │
│ Diff toolbar + file context        │ Files (Before/After)        │
│ Visual diff + change map           │ Summary | Risks | Tests |   │
│                                    │ Commit                      │
└────────────────────────────────────┴─────────────────────────────┘
```

- **Topbar** (`--topbar-h: 56px`): brand left; actions right (language switch,
  reset, notes toggle, settings, theme toggle). Sticky.
- **Content**: the diff is the primary surface. Its toolbar provides the
  All lines / Changes only segmented control and Previous / position / Next
  block navigation. A compact Before → After context row keeps filenames and
  stats next to the diff. The viewer owns vertical and horizontal scrolling.
- **Inspector** (`--inspector-w: 360px`): compact file inputs plus four focused
  analysis tabs: Summary, Risks, Tests, and Commit. It is docked at a 3:1
  diff-to-inspector ratio on wide screens, a right drawer on tablet, and a
  bottom sheet on mobile.

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
| `--text-muted` | `#6e6e73` | `#b5b5ba` | secondary text |
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
- **Segmented control**: two real buttons with `aria-pressed`; the selected
  mode uses the system accent.
- **Inspector tabs**: a keyboard-operable tablist with one visible panel at a
  time. The Commit panel keeps a copy action beside the generated message.

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
- **Loading**: the analysis loading status appears above the active tab while
  existing note content is dimmed; the diff remains usable.

## 11. Breakpoints

The diff-first layout uses wide, tablet, and mobile structural breakpoints.

| Name | Width | Behavior |
|---|---|---|
| wide (default) | ≥ 901px | content + inspector docked at a 3:1 ratio |
| tablet | 769–900px | content full width; inspector is a right-side drawer |
| mobile | ≤ 768px | single-column diff; inspector is a drawer |
| compact mobile | ≤ 520px | inspector becomes a bottom sheet; controls wrap |

## 12. PWA Behavior — "Always Latest"

DiffNote should fetch the latest code online while staying installable/offline;
when a release is ready, the user controls when the waiting release takes over.

- **Service worker = network-first** for all GET requests: try network, fall
  back to cache only when offline. This guarantees the latest source on every
  online load (the real fix for "force auto reload latest").
- **User-controlled update**: a new SW installs and waits. The registration
  module checks on load, focus, visibility return, and every 15 minutes while
  visible, then shows a persistent localized **Update Now** banner.
- **Activation**: clicking **Update Now** sends `SKIP_WAITING`; the worker
  activates and calls `clients.claim()`. The page listens for
  `controllerchange` and reloads **once**, guarded against loops and first
  install spurious reloads. **Later** defers the prompt until a later focus or
  visibility check; failures expose retry/dismiss actions.
- Manifest: `display: standalone`, light `theme_color`/`background_color`,
  192 + 512 maskable icons.

## 13. Accessibility

- AA contrast (≥4.5:1) for text in both themes.
- `:focus-visible` ring on every interactive element.
- Drawers/toggles reflect state via `aria-expanded` / `aria-pressed`.
- Segmented controls expose selected state with `aria-pressed`; the inspector
  tablist exposes `aria-selected`, `aria-controls`, and Left/Right/Home/End
  keyboard navigation.
- The minimap supports click and primary-pointer drag with a visible
  grab/grabbing affordance; the code area retains native text selection and
  horizontal scrolling.
- `prefers-reduced-motion` respected.
- Keyboard: dropzones focusable + Enter/Space activate; toggles are real buttons.
