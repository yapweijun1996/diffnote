# Architecture

DiffNote is a **local-first PWA** with **no build step and zero runtime
dependencies**. Everything is plain HTML/CSS/ES5-compatible JavaScript loaded
via `<script>` tags; modules communicate through small globals on `window`.

## Module map

| File | Global | Responsibility |
|---|---|---|
| `js/xor-number-cipher.js` | `XORNumberCipher` | Vendored XOR cipher (key obfuscation). |
| `js/icons.js` | `DiffNoteIcons` | Inline SVG icon set; injects into `[data-icon]`. |
| `js/diff.js` | `DiffNoteDiff` | LCS line-diff engine + stats. |
| `js/ai-mock.js` | `DiffNoteAI` | Deterministic local baseline change-note generator. |
| `js/settings.js` | `DiffNoteSettings` | Provider registry, XOR key store, generation settings. |
| `js/i18n.js` | `DiffNoteI18n` | Translation dictionary + `t()` / `apply()`. |
| `js/llm.js` | `DiffNoteLLM` | Provider adapters; structured note generation. |
| `js/ui.js` | `DiffNoteUI`, `DiffNoteToast` | Theme, inspector tabs/drawers/resizing, UI-only layout state, toast, topbar language switch, update banner. |
| `js/settings-ui.js` | — | Settings modal controller. |
| `js/app.js` | `DiffNoteApp` | File handling, diff render, minimap navigation, AI generation, copy, reset. |
| `js/sw-register.js` | — | Service worker registration, update prompt, and guarded reload. |
| `sw.js` | — | Network-first service worker. |

## Load order

`xor → icons → diff → ai-mock → settings → i18n → llm → ui → settings-ui → app → sw-register`

Each module is an IIFE that publishes its global before later modules use it.

## Data flow

```
File inputs ──FileReader──▶ DiffNoteDiff.compute() ──▶ rows + stats
                                       │
                 ┌─────────────────────┼─────────────────────┐
                                       ▼                     ▼                       ▼
        renderStats()           renderDiff()           renderAI() (local baseline)
                                                              │
                                       auto-generate after each diff
                                          (or Regenerate click)
                                                              ▼
                            DiffNoteSettings (provider + key + lang + commit opts)
                                                              ▼
                                       DiffNoteLLM.generateNotes() ──▶ renderNotes()
```

- The **diff engine** is pure and unit-tested; it never touches the DOM.
- Local baseline notes render instantly as an offline-safe fallback; the real
  LLM call then fires automatically and can be re-run via **Regenerate
  analysis**. The fallback is not exposed as a production status label.
- **Keys are decrypted only at call time** inside `DiffNoteSettings.resolve()`.

## UI V2 responsibilities

- `#diffViewer` remains the source of truth for rendered rows and the only
  vertical/horizontal scroll owner. The diff header mirrors filenames and
  stats from the same `lastResult` state.
- The segmented line-mode buttons only toggle the existing
  `.changes-only` presentation class; diff calculation and copy serialization
  remain unchanged.
- `#inspector` owns file inputs and four tab panels. `js/app.js` renders one
  structured notes object into Summary, Risks, Tests, and Commit containers;
  `js/ui.js` owns selection state and keyboard navigation.
- Wide screens dock the inspector at a 3:1 diff-to-inspector ratio. The
  `#inspectorResizeHandle` changes only the grid track and stores the final
  pixel width under `diffnote-inspector-width`. Width is clamped to 300px–50vw
  and leaves at least 420px for the diff. Tablet screens use a right drawer,
  and mobile uses a bottom sheet so the diff stays primary. Collapsing hides
  the docked track and expanding restores the previous width; no analysis or
  file state is persisted by these layout changes.

## i18n model

One language setting drives both UI and generated output:

- Static markup: `data-i18n="key"` (text) and `data-i18n-attr="attr:key;…"`.
- Dynamic strings: `DiffNoteI18n.t('key', vars)`.
- On change, `DiffNoteI18n.apply(document)` re-translates static nodes and
  `DiffNoteApp.onLanguageChange()` re-renders dynamic ones.

## Diff navigation

- `#diffViewer` owns the actual vertical and horizontal scrolling of rendered
  diff rows.
- `#diffMinimap` is a visual position map. A click jumps to the selected
  region; a primary pointer press followed by vertical movement continuously
  scrubs the viewer. Pointer capture keeps the drag active when the pointer
  leaves the narrow minimap, while the code area remains available for normal
  text selection and horizontal scrolling.
- `#minimapViewport` is updated from the viewer's scroll event, so the map
  remains synchronized after manual scrolling, drag navigation, filtering, and
  resize.

## Inspector resizing

- `js/ui.js` owns the separator pointer lifecycle, pointer capture cleanup,
  keyboard increments, double-click reset, breakpoint reconciliation, and the
  UI-only localStorage value. `js/app.js` does not read or write this state.
- The desktop grid reserves a 10px interaction lane with a 2px visual divider.
  Pointer movement changes Inspector width continuously; `pointercancel`,
  `lostpointercapture`, window pointer-up, and viewport resize all terminate or
  reconcile the interaction safely.

## PWA / "always latest"

- `sw.js` is **network-first**: it tries the network for every GET and falls
  back to cache only when offline — guaranteeing latest code online.
- GitHub Actions stamps `CACHE_VERSION` with the deployment commit SHA so each
  release owns a distinct offline cache.
- A new service worker installs and waits. `sw-register.js` checks for updates
  on page load, focus, visibility return, and every 15 minutes while visible.
- When a waiting worker is found, `js/ui.js` shows a persistent, localized
  banner. **Update Now** sends `SKIP_WAITING`; the worker activates, claims
  clients, and the page reloads once on `controllerchange`. **Later** hides the
  prompt until the next focus or visibility check. Failed activation exposes a
  retry/dismiss state.

## Design system

UI tokens (color, type, spacing, motion, layout) are defined in
[`DESIGN.md`](../DESIGN.md) and implemented as CSS custom properties in
`css/styles.css`. Light is the default theme; dark is `[data-theme="dark"]`.
