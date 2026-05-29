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

## Other static hosts

Upload the repository contents to any static host (Netlify, Vercel, Cloudflare
Pages, nginx, S3 + CloudFront). No build command is required; the publish
directory is the repo root. Ensure the host serves over HTTPS so the service
worker registers.

## ⚠️ Before deploying publicly

The Default gateway API key is XOR-obfuscated **in the client source** and is
therefore recoverable from a public deployment. Before shipping publicly:

1. Rotate / rate-limit the Default key, **or**
2. Remove the baked key and require users to paste their own, **or**
3. Front the provider with a backend proxy that holds the key server-side.

See [CONFIGURATION.md](CONFIGURATION.md#api-key-handling--security).
