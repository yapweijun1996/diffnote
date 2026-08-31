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
| `js/ai-mock.js` | `DiffNoteAI` | Deterministic mock change-note generator. |
| `js/settings.js` | `DiffNoteSettings` | Provider registry, XOR key store, generation settings. |
| `js/i18n.js` | `DiffNoteI18n` | Translation dictionary + `t()` / `apply()`. |
| `js/llm.js` | `DiffNoteLLM` | Provider adapters; structured note generation. |
| `js/ui.js` | `DiffNoteUI`, `DiffNoteToast` | Theme, drawers, toast, topbar language switch, update banner. |
| `js/settings-ui.js` | — | Settings modal controller. |
| `js/app.js` | `DiffNoteApp` | File handling, diff render, AI generation, copy, reset. |
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
        renderStats()           renderDiff()           renderAI() (mock)
                                                              │
                                       auto-generate after each diff
                                          (or Regenerate click)
                                                              ▼
                            DiffNoteSettings (provider + key + lang + commit opts)
                                                              ▼
                                       DiffNoteLLM.generateNotes() ──▶ renderNotes()
```

- The **diff engine** is pure and unit-tested; it never touches the DOM.
- **Mock notes** render instantly as a baseline; the real LLM call then fires
  automatically (and can be re-run via the **Regenerate** button).
- **Keys are decrypted only at call time** inside `DiffNoteSettings.resolve()`.

## i18n model

One language setting drives both UI and generated output:

- Static markup: `data-i18n="key"` (text) and `data-i18n-attr="attr:key;…"`.
- Dynamic strings: `DiffNoteI18n.t('key', vars)`.
- On change, `DiffNoteI18n.apply(document)` re-translates static nodes and
  `DiffNoteApp.onLanguageChange()` re-renders dynamic ones.

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
