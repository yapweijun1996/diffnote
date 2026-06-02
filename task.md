# DiffNote — Task Roadmap

> Source: UX/code review on 2026-06-02 (desktop 1440 / tablet 900 / mobile 375,
> dark mode, i18n switch, drawers, settings modal — zero console errors).
> Roadmap logic: **Now** (ship-blockers) → **Next** (high-value) → **Later** (polish/backlog).
> Status keys: ⬜ todo · 🔄 in-progress · ✅ done

---

## 🎯 Goal

Make the *default, offline* experience match the product promise: a localized,
discoverable, diff-first change-note tool. The engine is solid; the gaps are in
i18n coverage and responsive discoverability.

---

## 🟥 NOW — ship-blockers (do first)

### T0 · Startup-gate flow: inputs first, diff after ✅
- **Priority:** P0 · **Effort:** M · **Depends on:** — · **Source:** end-user feedback 2026-06-02
- **Done 2026-06-02:** `data-mode` on `.app` (`startup`/`diff`); dropzones relocate between
  `#startupZones` (centered) and `#dropzones` (compact sidebar) — same nodes, listeners
  preserved. Startup hides sidebar/inspector/diff + reset/notes/menu buttons. Reset returns
  to startup. Verified live at 1440 + 375, zero console errors. `empty.desc` copy updated
  (dropped "in the sidebar"). Dev note: clear an old cached service worker to see edits —
  network-first SW is correct, but a stale worker from a prior session can mask changes.
- **Problem:** The two file inputs are only useful *before* a diff exists (no two files →
  no diff). Today they sit permanently in the sidebar, eating space once the diff is shown.
- **Goal:** On startup show ONLY the input area (prominent, centered). After both files
  load and the diff renders, hide/collapse the inputs so the diff + notes own the screen.
- **Re-entry decision (RESOLVED → Option A "collapse, don't delete"):** after the diff
  shows, the big dropzones collapse into compact sidebar chips showing each filename
  (click a chip to replace just that one file). Honors "hide the big input" while keeping
  single-file swap one click — no dead-end. Reset still clears both → returns to startup.
- **Approach:** Add an app-level `mode` (`startup` | `diff`). `startup` = big centered
  dropzones, hide diff/notes; `maybeCompare()` success → `mode='diff'` collapses each
  dropzone to a filename chip (reuse `.has-file` state, add a compact CSS variant).
  Clicking a chip re-opens that file picker; Reset → `startup`.
- **Acceptance:**
  - [ ] Fresh load shows only the input area, no empty diff box / no empty notes panel.
  - [ ] Loading both files transitions to diff view with inputs hidden/collapsed.
  - [ ] A clear, discoverable way to change files exists (per chosen re-entry option).
  - [ ] Reset returns to the startup input view.
- **Note:** Reshapes T2 (discoverability) — collapsing inputs frees room; revisit T2 after.
- **Files:** `index.html`, `css/styles.css`, `js/app.js`, `js/ui.js`

### T1 · Localize the mock change-note generator ⬜
- **Priority:** P0 · **Effort:** M · **Depends on:** —
- **Problem:** `js/ai-mock.js` emits hardcoded English bodies (overview, breakdown,
  commit summary, risk/test notes). Switching UI to zh/ja/vi/ms translates only the
  headings → half-translated panel. Contradicts README "generated notes in 5 languages."
- **Approach:** Move the mock sentence templates into `js/i18n.js` DICT with `{var}`
  placeholders (counts, filename); have `ai-mock.js` build strings via `DiffNoteI18n.t`.
  Keep commit `type(scope)` prefix language-neutral; localize only the summary clause.
- **Acceptance:**
  - [ ] Switch language to Mandarin → every line under each heading renders in Mandarin.
  - [ ] Re-render fires on `onLanguageChange` (already calls `renderAI`) — no reload needed.
  - [ ] Commit message still respects `commitMaxLen` clamp after translation.
- **Files:** `js/ai-mock.js`, `js/i18n.js`

---

## 🟧 NEXT — high-value UX

### T2 · Fix change-notes discoverability at 769–1100px ⬜
- **Priority:** P1 · **Effort:** S–M · **Depends on:** —
- **Problem:** Below 1100px the inspector is an off-screen drawer; at ~1024px laptops
  users see a diff and no notes, and mock notes regenerate silently behind a closed
  drawer. Entry point is an unlabeled icon with no "ready" signal.
- **Approach (pick one):**
  - (a) Lower the docked breakpoint so the inspector stays docked on laptops (e.g.
    drawer only below ~900px), **or**
  - (b) Keep the drawer but add an affordance: badge/pulse on the notes button + a toast
    ("Change notes ready") when notes are first generated while the drawer is closed.
- **Acceptance:**
  - [ ] At 1024px, freshly compared files surface the notes (docked) OR a visible cue.
  - [ ] No content overlap; scrim still works on true narrow widths.
- **Files:** `css/styles.css`, `js/ui.js`, `js/app.js`

### T3 · Sync drawer/breakpoint state across 1100px ⬜
- **Priority:** P2 · **Effort:** S · **Depends on:** T2 (resolve together)
- **Problem:** Resize listener only watches the 769px boundary, but docked-vs-drawer
  flips at 1101px (`isWide`). `notes-hidden`/`notes-open`/`aria-pressed` can desync.
- **Approach:** Add a `matchMedia('(min-width: 1101px)')` change handler that normalizes
  classes + `aria-pressed`; consolidate with T2's chosen breakpoint.
- **Acceptance:**
  - [ ] Drag width across 1100px in both directions → inspector + button state stay correct.
- **Files:** `js/ui.js`

---

## 🟨 LATER — polish / backlog

### T4 · Diff long-line handling ⬜
- **Priority:** P3 · **Effort:** M
- **Problem:** Long lines wrap with no line-no/marker gutter on the wrapped portion.
- **Approach:** Offer a horizontal-scroll mode (toggle) or add a soft-wrap indent guide.
- **Files:** `css/styles.css`, (optional toggle) `js/ui.js`

### T5 · i18n regression guard ⬜
- **Priority:** P3 · **Effort:** S · **Depends on:** T1
- **Approach:** Tiny check that every DICT key has all 5 locales and no user-visible
  string is built outside `DiffNoteI18n.t`. Document in `docs/ARCHITECTURE.md`.
- **Files:** `js/i18n.js`, `docs/ARCHITECTURE.md`

---

## ✅ Verified working (no action)
- LCS diff correctness + stats · responsive 3-col→drawer layout · dark theme contrast ·
  settings modal (mobile-scrollable) · local-first FileReader flow · zero console errors.
