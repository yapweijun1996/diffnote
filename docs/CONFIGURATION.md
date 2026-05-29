# Configuration

All settings live in **Settings** (⚙ in the topbar) and persist to
`localStorage` under the key `diffnote-settings`.

## LLM Provider

| Provider | API style | Browser CORS | Notes |
|---|---|---|---|
| **Default** (GPT gateway) | OpenAI Responses | ✅ allowed | Zero-config; built-in key. The default. |
| **Gemini** | Google Generative Language | ✅ allowed | Paste a Google AI Studio key. |
| **OpenAI** | Chat Completions | ❌ blocked | `api.openai.com` sends no CORS header — needs a proxy. |
| **LM Studio** | Chat Completions (local) | ✅ if enabled | Point at `http://localhost:1234`; enable CORS in LM Studio. |

Each provider has an **Endpoint**, **Model**, and (except Default) an **API key**.
Use **Test connection** to verify before saving.

### Reasoning controls

| Provider | Control | Sent as | Values |
|---|---|---|---|
| **OpenAI** | Reasoning Effort | `reasoning_effort` | Default (omit) / Low / Medium / High |
| **Gemini** | Thinking Level | `generationConfig.thinkingConfig.thinkingBudget` | Default (model decides) / None (0) / Low (1024) / Medium (8192) / High (24576) |

- **Default (empty)** omits the parameter so non-reasoning models (e.g. `gpt-4o-mini`)
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

Keys are stored XOR-obfuscated (via the bundled
[XOR-Cipher-Tool](https://github.com/yapweijun1996/XOR-Cipher-Tool), key
`20260515`) in `localStorage` and decrypted only at call time. Because the XOR
key lives in the client JavaScript, **any baked-in key — including the Default
gateway key — is recoverable from page source once deployed.**

Recommendations:

- Treat the Default gateway key as a **rate-limited / throwaway** key and rotate it.
- Do **not** store sensitive production keys in a public deployment.
- For real secrecy, place a backend proxy in front of the provider and keep the
  key server-side.

See [ARCHITECTURE.md](ARCHITECTURE.md) for how settings flow through the app.
