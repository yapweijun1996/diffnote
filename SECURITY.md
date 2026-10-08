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

The Default gateway uses a short-lived Demo session held in memory. No private
gateway or provider credential is included in its client configuration.

User-entered keys for other providers are **XOR-obfuscated, not encrypted** in
localStorage. This does not protect keys against same-origin scripts. Keep
sensitive production credentials server-side.

The formerly bundled private gateway key may remain in Git history and old
browser caches; the gateway operator must revoke it. Removing it from current
source is not credential revocation. See
[docs/CONFIGURATION.md](docs/CONFIGURATION.md#api-key-handling--security).

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
