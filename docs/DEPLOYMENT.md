# Deployment

DiffNote is a static site — any static host works. This repo ships a GitHub
Pages workflow.

## GitHub Pages (included)

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) deploys the
repo root to GitHub Pages on every push to `main` (and via manual
`workflow_dispatch`).

**One-time setup:** in the repository, go to
**Settings → Pages → Build and deployment → Source** and select
**GitHub Actions**.

After that, each push to `main` publishes to
`https://<user>.github.io/<repo>/`.

### Why it "just works" under a subpath

All asset references are **relative** (`./…`), the manifest uses
`"start_url": "./index.html"` and `"scope": "./"`, and the service worker
registers at a relative path — so the app runs correctly whether served from a
domain root or a project subpath.

### What gets deployed

Only committed files are checked out, so local artifacts ignored by
[`.gitignore`](../.gitignore) (e.g. `.verify/` screenshots) never reach the
deployment.

### Service worker update rollout

GitHub Actions stamps the HTML `app-version` and worker `CACHE_VERSION` with
one visible identifier (`v11+<short commit SHA>`). Bump the local `v11` baseline
in both source files and the deployment workflow for a new numbered release.

The page automatically activates an installed worker, then reloads once when
visible and safe. Open files, file operations, AI generation, and an open
Settings dialog delay refresh. After resetting the comparison or finishing
settings, the page refreshes automatically. The versioned **Update Now** button
is optional and explicitly discards the current in-memory work.

Before automatic activation, the worker checks that all tabs under this app's
scope support deferred refresh. Existing tabs running the former JavaScript do
not respond, so the new release waits and retries automatically until those
tabs close or load the new client through normal navigation/reopening. The old
manual update action remains compatible. A worker cannot replace JavaScript
already executing in a tab; this handshake prevents a new tab from forcing an
old tab to refresh and lose its comparison during the one-time transition.

## Other static hosts

Upload the repository contents to any static host (Netlify, Vercel, Cloudflare
Pages, nginx, S3 + CloudFront). No build command is required; the publish
directory is the repo root. Ensure the host serves over HTTPS so the service
worker registers.

## ⚠️ Before deploying publicly

Default generation uses the gateway's public Demo project `github-pages`,
registered for Origin `https://yapweijun1996.github.io` (the `/diffnote/` path is
not part of Origin). Register exact Origins for any additional deployment;
never put a private `gw_` or provider key in a browser bundle.

Confirm that `/demo/session` issues a token and `/demo/v1/responses` completes
an SSE response from the deployment Origin. Session/model checks alone do not
prove generation works. Resolve gateway errors before release; see
[CONFIGURATION.md](CONFIGURATION.md#default-demo-gateway).

Revoke the formerly baked private key on the gateway, including when older
PWA caches or Git history still contain it. The new service worker cache version
refreshes the app shell through automatic activation and safe page reload.

See [CONFIGURATION.md](CONFIGURATION.md#api-key-handling--security).
