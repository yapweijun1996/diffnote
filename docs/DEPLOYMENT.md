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

The current worker installs a new release and waits for **Update Now** before
activating it. GitHub Actions stamps the deployed `CACHE_VERSION` with the
commit SHA, so every release gets a distinct offline cache.

For the first public rollout from the previous immediate-activation behavior,
use two deployments: first ship the update UI/registration support while
retaining the old `skipWaiting()` behavior, then ship the waiting/message-driven
worker behavior. This gives already-open old clients time to receive the new
registration code. Once this migration is complete, normal releases use the
single waiting-worker flow.

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
refreshes the app shell through the existing user-controlled update flow.

See [CONFIGURATION.md](CONFIGURATION.md#api-key-handling--security).
