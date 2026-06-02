# Security Policy

## Supported versions

DiffNote is a rolling, zero-build static PWA deployed from `main` to GitHub
Pages. Only the **latest deployed version** (current `main`) is supported; there
are no maintained release branches.

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ |
| older commits | ❌ |

## Known limitation — API key handling

This is **by design and already documented**, not a vulnerability to report:

API keys (including the built-in Default gateway key) are **XOR-obfuscated, not
encrypted**. Because the XOR key lives in the client JavaScript, any baked-in key
is recoverable from the page source once deployed. Treat the Default gateway key
as a rate-limited / throwaway key, and do not store sensitive production keys in
a public deployment. See
[docs/CONFIGURATION.md](docs/CONFIGURATION.md#api-key-handling--security) for the
full rationale and mitigations (rotate, rate-limit, or proxy the provider).

## Reporting a vulnerability

For issues **beyond** the documented key-handling limitation above:

- **Preferred:** open a private report via GitHub Security Advisories
  (repository → **Security** → **Report a vulnerability**), so details stay
  private until a fix ships.
- **Alternative:** email the maintainer at <yapweijun1996@gmail.com>.
  <!-- TODO: replace with a dedicated security contact if you prefer not to use a personal address. -->

Please do **not** open a public issue for security vulnerabilities. Include steps
to reproduce and the affected URL/commit if you can. There is no formal SLA for a
hobby project, but reports will be acknowledged as soon as practical.
