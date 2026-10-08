# Configuration

All settings live in **Settings** (⚙ in the topbar) and persist to
`localStorage` under the key `diffnote-settings`.

## LLM Provider

| Provider | API style | Browser CORS | Notes |
|---|---|---|---|
| **Default** (Demo gateway) | Streamed Demo Responses | Registered Origins only | Origin-bound session; no private key. The default. |
| **Gemini** | Google Generative Language | ✅ allowed | Paste a Google AI Studio key. |
| **OpenAI** | Chat Completions | ❌ blocked | `api.openai.com` sends no CORS header — needs a proxy. |
| **LM Studio** | Chat Completions (local) | ✅ if enabled | Point at `http://localhost:1234`; enable CORS in LM Studio. |

Each provider has an **Endpoint**, **Model**, and (except Default) an **API key**.
Use **Test connection** to verify before saving. Default Endpoint and Model are
fixed to the public Demo contract; other providers retain editable settings.

### Default Demo gateway

- Project: `github-pages`; registered Origin: `https://yapweijun1996.github.io`.
- Session: `POST https://gpt.yapweijun1996.com/demo/session` with
  `{ "project_id": "github-pages" }`, without Authorization.
- Generation: `POST /demo/v1/responses`, model `demo-auto`, `stream: true`,
  and explicit `reasoning.effort` (Low by default).
- The browser supplies Origin automatically. Session tokens remain in memory,
  refresh one minute before the documented 15-minute expiry, and are shared by
  concurrent callers. An HTTP 401 refreshes once; quota errors and started
  streams are never replayed automatically.
- Existing Default private model, endpoint, and key overrides are ignored.
- The adapter buffers SSE across network chunks and requires a completed
  response before publishing notes. Failed, incomplete, and disconnected streams
  trigger the existing local-note fallback with a visible error.
- JSON output is requested in the prompt and parsed locally. The current project
  rejects `text.format` with `DEMO_FORMAT_DISABLED`, so it is not sent.
- Localhost and custom hosts need their exact Origin registered for this project,
  or a separate Demo project configured in `js/settings.js`. Private API CORS
  permission alone does not authorize a Demo session. If Turnstile becomes
  required, integrate its browser challenge before using this client.

### Reasoning controls

| Provider | Control | Sent as | Values |
|---|---|---|---|
| **Default** | Reasoning Effort | `reasoning.effort` | Low / Medium / High |
| **OpenAI** | Reasoning Effort | `reasoning_effort` | Default (omit) / Low / Medium / High |
| **Gemini** | Thinking Level | `generationConfig.thinkingConfig.thinkingBudget` | Default (model decides) / None (0) / Low (1024) / Medium (8192) / High (24576) |

- OpenAI's **Default (empty)** option omits the parameter so non-reasoning models (e.g. `gpt-4o-mini`)
  are not affected. Set it only when using a reasoning model (o-series, gpt-5, etc.).
- Gemini levels map to a thinking-token budget; "None" disables thinking (supported on
  2.5 Flash, not Pro).

## Generation settings

- **Change Notes Language (i18n):** English (default), Mandarin, Vietnamese,
  Malay, Japanese. Localizes both the UI and the generated notes.
- **Commit Message Length:** 20–500 characters (slider + number), default **70**.
  Enforced both via the prompt and a hard client-side truncation.
- **Commit Message Prompt:** editable template for the commit instruction.
  Placeholders `{lang}` and `{maxLen}` are substituted at call time.
  "Reset to default" restores the built-in template.

## API key handling & security

> ⚠️ **API keys are XOR-obfuscated, not encrypted.**

The Default provider contains no gateway or provider API key. Its short-lived
`dmo_` session token is kept only in memory, not in localStorage or the service
worker cache. Provider credentials stay on the gateway server.

User-entered Gemini, OpenAI, and LM Studio keys retain the existing XOR
obfuscation in localStorage. This does not protect them from scripts running on
the same origin. Do not store sensitive production keys in the frontend; use a
server-side proxy when secrecy is required.

The old baked private gateway key was removed from current source, but may
remain in Git history and previously deployed bundles. The gateway operator
must revoke that old key; deleting source does not revoke a credential.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how settings flow through the app.
