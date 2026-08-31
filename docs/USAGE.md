# Usage

DiffNote compares two versions of a file and produces a visual diff plus
copyable change notes — entirely in your browser.

## 1. Open the app

Serve over `localhost` (a service worker requires a secure context):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

> Opening `index.html` via `file://` works for the diff, but the PWA / offline
> layer will not register.

## 2. Compare files

1. On the **startup screen**, drop or click to load a **Before** file.
2. Load an **After** file. The inputs collapse into the inspector and the diff
   takes over the screen.
3. The visual diff, stats (added / deleted / changed blocks), and a baseline
   set of (mock) change notes render automatically.

## 3. Generate AI change notes

1. After the diff renders, AI change notes are generated **automatically** —
   the mock baseline is replaced with AI-written Overview, Change Breakdown,
   Commit Message, Risk Notes, and Test Suggestions. Click **Regenerate** in
   the Change Notes panel to run it again.
2. Click **Copy** next to the commit message to copy it.

The provider, output language, commit length, and prompt are configured in
**Settings** — see [CONFIGURATION.md](CONFIGURATION.md).

## 4. Language

Use the 🌐 switcher in the topbar (or the Settings panel) to change the
language. One setting localizes **both** the interface and the AI-generated
notes. Supported: English, Mandarin, Vietnamese, Malay, Japanese.

## 5. Theme

Toggle light / dark with the topbar button. Light is the default; your choice
is remembered.

## 6. Install as a PWA

Use your browser's install prompt to install DiffNote for offline use. The
service worker is network-first, so you always get the latest code online while
remaining usable offline. When a new release is ready, DiffNote shows a
persistent update banner:

- Select **Update Now** to activate the waiting release and reload once.
- Select **Later** to keep working; the prompt returns on a later focus or
  visibility check.
- During activation, the banner shows **Updating…**. If activation fails,
  choose **Retry** or **Dismiss**.

Files and settings remain local to the browser. Updating reloads the page, so
keep any in-progress file selection or unsaved UI state in mind before choosing
**Update Now**.

## Keyboard & accessibility

- Dropzones are focusable; <kbd>Enter</kbd> / <kbd>Space</kbd> opens the file picker.
- All interactive elements show a visible focus ring.
- The interface respects `prefers-reduced-motion`.
