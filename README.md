# DiffNote

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-installable-5a3fc0.svg)](manifest.webmanifest)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)
[![Deploy](https://github.com/yapweijun1996/diffnote/actions/workflows/deploy.yml/badge.svg)](.github/workflows/deploy.yml)

A **local-first PWA** for developers: drop in a *before* and *after* version of
a file, read a clean visual diff, and get copyable change notes — Overview,
Change Breakdown, Commit Message, Risk Notes, Test Suggestions — shown instantly
by a mock generator and then auto-upgraded by a real LLM.

> 🔒 **Local-first:** files are read in-browser with `FileReader` and never
> uploaded. The only outbound request is the AI change-note call, which sends
> the computed diff to your selected provider automatically after each
> comparison (re-run any time with **Regenerate**).

## Features

- 🔀 Line-level visual diff (added / deleted / unchanged) with stats
- 🧠 Change notes — instant mock baseline, or real LLM (Default gateway / Gemini / OpenAI / LM Studio)
- 🌐 Full i18n — UI **and** AI-generated notes in English, Mandarin, Vietnamese, Malay, Japanese (the instant mock baseline is English)
- 🎨 Apple-inspired admin UI, light default + dark toggle, SVG icons, responsive
- ⚙️ Configurable commit-message length & prompt
- 📱 Installable PWA, **network-first** service worker (always latest, offline-capable)
- 🛠️ Zero build, zero dependencies — plain HTML/CSS/JS

## Quick start

```bash
# A service worker needs a secure context, so serve over localhost:
python3 -m http.server 8000
# open http://localhost:8000
```

Then: load a **Before** and **After** file → read the diff → AI notes generate
automatically (re-run with **Regenerate**) → **Copy** the commit message.

## Documentation

| Doc | What's inside |
|---|---|
| [docs/USAGE.md](docs/USAGE.md) | How to use every feature |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | Providers, languages, commit settings, key security |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Module map, data flow, PWA & i18n model |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | GitHub Pages + other static hosts |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Dev setup & conventions |
| [DESIGN.md](DESIGN.md) | Design system (SSOT) |

## ⚠️ Security note

API keys are **XOR-obfuscated, not encrypted**. The built-in Default gateway key
is recoverable from page source once deployed — rotate it, rate-limit it, or
proxy the provider. Details in
[docs/CONFIGURATION.md](docs/CONFIGURATION.md#api-key-handling--security).

## Project structure

```
index.html              Admin shell UI + Settings modal
css/styles.css          Design-token theme (light default + dark)
js/                     xor-number-cipher, icons, diff, ai-mock, settings,
                        i18n, llm, ui, settings-ui, app, sw-register
manifest.webmanifest    PWA manifest
sw.js                   Network-first service worker
icons/                  App icons (192 / 512)
samples/                Before/After sample pairs (.js .html .cfm .md)
docs/                   Documentation
DESIGN.md               Design system SSOT
```

## Deploy

Push to `main` → GitHub Pages publishes automatically (set **Pages → Source** to
**GitHub Actions** once). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## License

[MIT](LICENSE) © 2026 yapweijun1996 — free for personal **and commercial** use.
