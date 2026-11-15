# Deploying DevGuru

DevGuru is a static site: `npm run build` writes everything to `dist/`. There are three ways to publish it. All three use the same two config files, so headers and routing stay the same everywhere:

| File                 | What it controls                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `customHttp.yml`     | security headers (Content-Security-Policy and others) and cache headers                                                                             |
| `amplify-rules.json` | the SPA rule: every app route (`/track/python/lists`) is answered with `/index.html`; real files (`.js`, `.wasm`, `.png`...) are served as they are |

## 1. From your computer (current setup)

```bash
npm run deploy                 # build, upload, publish, print the URL
npm run deploy -- --dry-run    # build + dist.zip only, no AWS calls
npm run deploy -- --skip-build # upload the dist/ you already have
```

Needs AWS CLI v2 and a login (`aws configure`). Settings: `deploy.config.json` (app `d2b6t6o0frsg93`, branch `main`, region `ap-south-1`). The script also sends `customHttp.yml` and `amplify-rules.json` to Amplify on every deploy.

## 2. From GitHub Actions (automatic)

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: content check, typecheck, lint, formatting, tests, build, and CDK tests + synth. The built site is kept as a downloadable artifact for 7 days.
- **Deploy** (`.github/workflows/deploy.yml`) runs `npm run deploy` after CI passes on `main`, or by hand (Actions → Deploy → Run workflow). It logs in to AWS with **OIDC**: no AWS keys are stored in GitHub.

One-time setup:

1. Create the deploy role: `cd infra && npm install && npx cdk bootstrap && npm run deploy:github-role` (see `infra/README.md`).
2. GitHub → Settings → Secrets and variables → Actions → **Variables** → New: `AWS_DEPLOY_ROLE_ARN` = the `DeployRoleArn` output.
3. The workflow uses the GitHub environment **production** (created automatically on the first run). Optional: Settings → Environments → production → Required reviewers, to approve each deploy.

Until `AWS_DEPLOY_ROLE_ARN` exists, the Deploy workflow skips itself.

## 3. Amplify connected to GitHub (alternative)

Amplify can build the site itself on every push using `amplify.yml`. An app created by `npm run deploy` (manual deploys) cannot be connected to Git later, so this means a **new** Amplify app: Amplify console → Create new app → GitHub → this repository → branch `main`. Then:

- Build settings: detected from `amplify.yml` (Node 22, `npm ci`, `npm test`, `npm run build`, output `dist`).
- Headers: read from `customHttp.yml` automatically.
- Rewrites: App settings → Rewrites and redirects → Manage → Open text editor → paste `amplify-rules.json`.

Use either this or the GitHub Actions deploy, not both.

## 4. S3 + CloudFront with CDK (alternative)

`infra/` has a `DevGuruSite` stack: private S3 bucket, CloudFront with Origin Access Control, the same headers (from `customHttp.yml`) and the same SPA rule (from `amplify-rules.json`, as a CloudFront Function). See `infra/README.md`.

## Content-Security-Policy

```
default-src 'self';
script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net;
worker-src 'self';
connect-src 'self' https://cdn.jsdelivr.net https://s3.ap-south-1.amazonaws.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data:; font-src 'self'; manifest-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self';
frame-ancestors 'none'; upgrade-insecure-requests
```

| Allowance                                           | Why                                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `'wasm-unsafe-eval'`                                | Pyodide (Python) and sql.js (SQLite) compile WebAssembly. It does **not** allow JavaScript `eval`.               |
| `https://cdn.jsdelivr.net`                          | Pyodide 0.26.4 and its packages are loaded from jsDelivr (`src/workers/pyodide.worker.ts`).                      |
| `https://s3.ap-south-1.amazonaws.com` (connect-src) | logged-in progress is read and saved in the bucket `com.shubham.devguru` (see `docs/login.md`).                  |
| `style-src 'unsafe-inline'`                         | The code editor (CodeMirror) adds `<style>` tags at run time. Scripts stay strict: no inline scripts, no `eval`. |

**Tested** (15 Nov 2026) in headless Chrome against the production build, with the headers parsed from `customHttp.yml`: 14 page types (every playground kind, cheat sheets, search, progress), Python run, SQL run and the service worker, with **no CSP violations and no console errors**. Pyodide was served from a local copy of the same version during the test.

If you add a script, font, image or API from another site, add its origin to the matching `*-src` entry, or the browser will block it. `tests/hosting.test.ts` checks that the policy still allows the Pyodide host the worker uses.

Other headers on every response: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera, microphone, geolocation, payment, USB off), `Cross-Origin-Opener-Policy: same-origin`.

## Caching

| Path                                                               | Cache-Control                         | Why                               |
| ------------------------------------------------------------------ | ------------------------------------- | --------------------------------- |
| `/assets/*`                                                        | `public, max-age=31536000, immutable` | file names contain a content hash |
| `/index.html`, `/sw.js`, `/manifest.webmanifest`, `/theme-init.js` | `no-cache`                            | always check for a new version    |

The service worker (`sw.js`) keeps the app working offline and shows "New content is available → Refresh" after a deploy.
