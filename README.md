# DevGuru

**Learn backend and cloud tech the simple way.** DevGuru explains Python, SQL, Django, FastAPI, Flask, REST, AWS, Git, Docker, Linux, DSA and System Design in simple English, with real-life analogies and **code you can run in your browser** — no server, no install.

- **390 topics** in 12 tracks. Every topic: analogy → simple explanation → code with real output → "Try it yourself" playground → common mistakes → interview questions → quiz → cheat sheet.
- **Runs in the browser**: Python (Pyodide), SQL (SQLite via sql.js), and simulators for Git, a Linux/Docker terminal, REST APIs and AWS architecture diagrams.
- **Works offline** after the first visit (PWA), on phones first.
- **No account needed.** Progress is saved in the browser. Optional login with a phone number or username keeps it on every device ([docs/login.md](docs/login.md)).
- Frontend only: React 18 + Vite + TypeScript (strict) + Tailwind + MDX. Hosted on **AWS Amplify**.

| Track               | Topics | Playground                                                    |
| ------------------- | ------ | ------------------------------------------------------------- |
| 🐍 Python           | 64     | Python (Pyodide) + step-through visualizer                    |
| 🗄️ SQL              | 58     | SQLite with a sample database + JOIN visualizer               |
| 🎸 Django           | 37     | code + diagrams (needs a real server)                         |
| ⚡ FastAPI          | 23     | code + diagrams                                               |
| 🧪 Flask            | 25     | code with real output (run it on your computer)               |
| 🌐 REST APIs & HTTP | 28     | request builder with a mock API                               |
| ☁️ AWS              | 31     | clickable architecture diagrams                               |
| 🌿 Git & GitHub     | 29     | Git simulator with a live commit graph                        |
| 🐳 Docker           | 20     | simulated terminal with Docker                                |
| 🐧 Linux & Bash     | 25     | simulated Linux terminal (Bash scripts, sed, awk, systemctl…) |
| 🧩 DSA in Python    | 28     | Python + sort / search / BFS / DFS / stack visualizers        |
| 🏗️ System Design    | 22     | architecture diagrams + Python simulations                    |

---

## Contents

1. [Run it on your computer](#1-run-it-on-your-computer)
2. [Commands](#2-commands)
3. [Project structure](#3-project-structure)
4. [Add or change content](#4-add-or-change-content)
5. [Login and online progress](#5-login-and-online-progress)
6. [Deploy to AWS Amplify (beginner guide)](#6-deploy-to-aws-amplify-beginner-guide)
7. [Optional: S3 + CloudFront with CDK](#7-optional-s3--cloudfront-with-cdk)
8. [Monthly AWS cost](#8-monthly-aws-cost)
9. [Quality checks and CI](#9-quality-checks-and-ci)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Run it on your computer

You need **Node.js 22** (the version in `.nvmrc`) and npm.

```bash
git clone https://github.com/shubhamzxv/DevGuru.git   # or git@github.com:shubhamzxv/DevGuru.git
cd DevGuru
npm install
npm run dev
```

Open **http://localhost:5173**. Pages reload by themselves when you save a file.

To try the real production build (service worker, offline mode):

```bash
npm run build
npm run preview      # http://localhost:4173
```

Python needs internet the first time: Pyodide (~8 MB) is loaded from jsDelivr and then cached.

## 2. Commands

| Command                                                      | What it does                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `npm run dev`                                                | dev server with hot reload                                                              |
| `npm run build`                                              | content check → typecheck → production build in `dist/`                                 |
| `npm run preview`                                            | serve `dist/` locally                                                                   |
| `npm test`                                                   | all unit tests (Vitest)                                                                 |
| `npm run validate`                                           | content check: every topic file, title, quiz and block is valid                         |
| `npm run typecheck`                                          | TypeScript, strict                                                                      |
| `npm run lint`                                               | ESLint                                                                                  |
| `npm run format`                                             | Prettier (writes the files)                                                             |
| `npm run new:topic -- <track> <slug> "<Title>" ["<Module>"]` | create a topic from the template                                                        |
| `npm run new:track -- <slug> "<Name>" "<emoji>"`             | create a new track                                                                      |
| `npm run deploy`                                             | build and publish to AWS Amplify ([section 6](#6-deploy-to-aws-amplify-beginner-guide)) |

## 3. Project structure

```
DevGuru/
├─ src/
│  ├─ content/<track>/        index.json (the syllabus) + one .mdx file per topic
│  ├─ components/
│  │  ├─ content/             topic template blocks: Analogy, CodeBlock, MistakeBox, InterviewQA, CheatSheet…
│  │  ├─ playground/          Python, SQL, Git, terminal, HTTP playgrounds + code editor
│  │  ├─ visualizers/         Sort, BinarySearch, GraphTraversal, StackQueue, Join, Git graph, AWS diagram…
│  │  ├─ account/             login button, dialog, progress card
│  │  └─ layout/              header, sidebar, mobile drawer, bottom bar
│  ├─ simulators/             the engines: git.ts, shell.ts, bash.ts, docker.ts, http.ts, algorithms.ts…
│  ├─ workers/                pyodide.worker.ts (Python runs off the main thread)
│  ├─ registry/               tracks, topics and the MDX components a topic may use
│  ├─ utils/                  storage (progress), cloudSync (login), search, theme…
│  ├─ build/                  Vite plugins: search index + cheat sheets, service worker
│  └─ data/seed.sql           the sample database for the SQL track
├─ public/                    icons, manifest, wasm/sql-wasm.wasm, robots.txt
├─ tests/                     Vitest tests
├─ scripts/                   validate-content, new-topic, new-track, deploy
├─ docs/                      deploy.md, login.md, syllabus.md
├─ infra/                     optional AWS CDK app + S3 bucket config for login
├─ customHttp.yml             security + cache headers (Amplify)
├─ amplify-rules.json         SPA rewrite rule (Amplify)
├─ amplify.yml                build settings for a Git-connected Amplify app
└─ deploy.config.json         which Amplify app `npm run deploy` publishes to
```

Content is fully separate from the UI: adding a topic or a track needs **no code change**.

## 4. Add or change content

### Add a topic

A topic is **one MDX file + one entry in the track's `index.json`**. The script does both:

```bash
npm run new:topic -- python decorators "Decorators" "Functions"
```

This adds `{ id, slug, title }` under the module "Functions" in `src/content/python/index.json` and creates `src/content/python/decorators.mdx` with every block of the template. Fill it in, then run:

```bash
npm run validate
```

A topic that is in `index.json` but has no MDX file yet shows as **"Coming soon"**.

### The topic template

````text
---
id: python-decorators # never change after publishing: progress is saved under it
title: Decorators # must match index.json
summary: 'One sentence: what it is.' # quote it if it contains ": "
updated: '2026-11-15'
---

<Analogy> real-life example </Analogy>

## Simple explanation

…

## Code example

```python
print("hello")
```

```output
hello
```

<Playground kind="python"> …starter code in a fenced block… </Playground>

<Mistakes>
<Mistake title="…">
<Wrong>
wrong code
</Wrong>
<Right>
right code
</Right>
</Mistake>
</Mistakes>

<InterviewQA>
<QA q="Question?">
Answer.
</QA>
</InterviewQA>

<Quiz questions={[{ q: '…', options: ['a', 'b', 'c', 'd'], answer: 1, why: '…' }]} />

<CheatSheet> | table | … | </CheatSheet>
````

**Playground kinds** (`<Playground kind="…">`):

| kind       | The fenced block inside is                     | Example track      |
| ---------- | ---------------------------------------------- | ------------------ |
| `python`   | Python code, runs in Pyodide                   | Python, DSA        |
| `sql`      | SQL, runs on `src/data/seed.sql`               | SQL                |
| `git`      | one Git command per line                       | Git                |
| `terminal` | one shell command per line (Bash, Docker)      | Linux, Docker      |
| `http`     | `METHOD /path`, headers, blank line, JSON body | REST               |
| `diagram`  | JSON: `nodes`, `edges`, `flows`                | AWS, System Design |
| `none`     | code shown with a Copy button                  | Django, FastAPI    |

**Visualizers** (inside `<Visual caption="…">`): `<SortVisualizer algorithm="merge" values={[…]} />`, `<BinarySearchVisualizer values={[…]} target={23} />`, `<GraphTraversal mode="bfs" />`, `<StackQueueVisualizer mode="queue" />`, `<JoinVisualizer type="left" />`. The full list is in `src/registry/mdxComponents.ts`.

**Writing rules**: simple English, short sentences, keyword in **bold** the first time, Indian real-life analogies, every concept has a real example with its **real output** (run the code first — never guess an output). MDX tip: write `<tag>` and `{ }` inside backticks in normal text, or MDX treats them as code.

### Change a topic

Edit the MDX file and set `updated:` to today. Never change `id`.

### Add a track

```bash
npm run new:track -- kubernetes "Kubernetes" "☸️"
```

It creates `src/content/kubernetes/index.json`. The sidebar, home page, search, cheat sheets and routes pick it up automatically.

## 5. Login and online progress

Guests work exactly as before. A learner can **log in with a phone number or a username**; progress is then saved as one JSON file in the S3 bucket `com.shubham.devguru` (Mumbai) and kept in step on every device. There is no backend: the browser reads the file with `GET` and saves it with `PUT`. Phone numbers are never stored — the file name is a SHA-256 hash.

- Bucket setup (once): `infra/progress-bucket/` — see the commands in [docs/login.md](docs/login.md).
- Change or turn off: `VITE_PROGRESS_BASE_URL` in `.env` (empty = login hidden).
- **Limits**: no password or OTP, and the bucket accepts writes from anyone. Fine for learning progress; read the security section in [docs/login.md](docs/login.md) before storing anything else.

## 6. Deploy to AWS Amplify (beginner guide)

**AWS Amplify Hosting** serves the site from a global CDN with free HTTPS. DevGuru is a static site, so Amplify only needs the `dist/` folder. Three ways, easiest first:

| Way                                        | Good for                            |
| ------------------------------------------ | ----------------------------------- |
| **A. `npm run deploy`** from your computer | one command, what this project uses |
| **B. Upload a zip** in the Amplify console | no AWS CLI at all                   |
| **C. Automatic** with GitHub Actions       | deploy on every push to `main`      |

### A. One command from your computer

**Step 1 — Create an AWS account** at https://aws.amazon.com and sign in to the console.

> 📸 _Screenshot placeholder: AWS console home page after sign-in._

**Step 2 — Create a user for the command line.** Console → IAM → Users → Create user (for example `devguru-deployer`) → Attach policy **AdministratorAccess-Amplify** → Create. Open the user → Security credentials → **Create access key** → "Command Line Interface (CLI)". Copy the two keys.

> 📸 _Screenshot placeholder: IAM → Create user → Permissions with "AdministratorAccess-Amplify" ticked._

(Using IAM Identity Center / `aws configure sso` instead of access keys is safer if you already have it.)

**Step 3 — Install the AWS CLI v2** (https://aws.amazon.com/cli/) and log in with a named profile:

```bash
aws configure --profile shubham-dev
# Access key ID, Secret access key, region: ap-south-1, output: json
aws sts get-caller-identity --profile shubham-dev    # check it works
```

**Step 4 — Check `deploy.config.json`:**

```json
{
  "appName": "devguru",
  "branch": "main",
  "region": "ap-south-1",
  "profile": null,
  "appId": "d2b6t6o0frsg93"
}
```

Leave `appId` empty for a brand-new app: the first deploy creates the app and fills it in. Set `"profile": "shubham-dev"` here, or pass it each time.

**Step 5 — Deploy:**

```bash
npm run deploy -- --profile shubham-dev
```

It builds, zips `dist/`, creates the app if needed, sets the rewrite rule (`amplify-rules.json`) and headers (`customHttp.yml`), uploads, waits, and prints the URL, for example `https://main.d2b6t6o0frsg93.amplifyapp.com`.

> 📸 _Screenshot placeholder: terminal output ending with "Live at https://main.….amplifyapp.com"._

Other options: `-- --dry-run` (build + `dist.zip`, no AWS), `-- --skip-build` (upload the existing `dist/`).

**Step 6 — Check the live site**: open a topic, press **Run** in a Python playground, run a SQL query, then turn on airplane mode and reload (it should still open).

> 📸 _Screenshot placeholder: the live site on a phone with a Python playground output._

### B. Upload a zip in the console (no CLI)

1. `npm run deploy -- --dry-run` → creates `dist.zip`.
2. Amplify console → **Create new app** → **Deploy without Git** → app name `devguru`, branch `main` → drag `dist.zip` → **Save and deploy**.
   > 📸 _Screenshot placeholder: "Deploy without Git" page with the zip dropped._
3. App settings → **Rewrites and redirects** → Manage → **Open text editor** → paste the contents of `amplify-rules.json` → Save. (Without this, refreshing `/track/python` gives a 404.)
   > 📸 _Screenshot placeholder: rewrites text editor with the rule pasted._
4. App settings → **Custom headers** → paste the contents of `customHttp.yml` → Save.
5. Next time: open the app → **Deploy updates** → drag the new `dist.zip`.

### C. Automatic deploys with GitHub Actions

`.github/workflows/ci.yml` checks every push; `.github/workflows/deploy.yml` runs `npm run deploy` after CI passes on `main`, logging in with **OIDC** (no AWS keys stored in GitHub). One-time setup: create the deploy role with the CDK stack, then add the repository variable `AWS_DEPLOY_ROLE_ARN`. Full steps: [docs/deploy.md](docs/deploy.md).

(Amplify can also build from GitHub itself using `amplify.yml`. That needs a **new** Git-connected Amplify app, because an app made by uploads cannot be connected to Git later. Use either that or GitHub Actions, not both.)

### Custom domain (optional)

Amplify console → your app → **Hosting → Custom domains → Add domain**. If the domain is in Route 53, Amplify adds the records itself; otherwise add the CNAME records it shows at your domain provider. The SSL certificate is free and renews automatically. Then add the new address to `AllowedOrigins` in `infra/progress-bucket/cors.json` and run `put-bucket-cors` again, so login keeps working.

> 📸 _Screenshot placeholder: Custom domains page showing the domain "Available"._

## 7. Optional: S3 + CloudFront with CDK

`infra/` is an AWS CDK app (TypeScript) with two stacks:

- **`DevGuruSite`** — private S3 bucket + CloudFront (Origin Access Control, HTTP/2 + 3, compression), the **same** security headers (read from `customHttp.yml`) and SPA rule (read from `amplify-rules.json`, as a CloudFront Function). Hashed files cached for a year, `index.html` and the service worker never cached.
- **`DevGuruGithubDeploy`** — the GitHub OIDC role used by the Deploy workflow.

```bash
npm run build
cd infra
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1 --profile shubham-dev   # once per account/region
npm run deploy:site -- --profile shubham-dev                           # prints SiteUrl
```

Custom domain: put `domainName` and a **us-east-1** ACM `certificateArn` in `infra/cdk.json`. Details: [infra/README.md](infra/README.md).

## 8. Monthly AWS cost

Measured for this build: a first visit downloads about **2.6 MB** (the whole app is pre-cached for offline use); return visits download almost nothing. Python comes from jsDelivr, so it does not count. Prices: Amplify Hosting **$0.15 per GB served**, **$0.023 per GB stored**, **$0.01 per build minute**; S3 (Mumbai) about **$0.005 per 1,000 PUT** and **$0.0004 per 1,000 GET**.

| Monthly use                             | Amplify data served | Progress saves (S3) | Estimated cost |
| --------------------------------------- | ------------------- | ------------------- | -------------- |
| 300 new visitors (personal / portfolio) | ~0.8 GB             | 5,000 PUT           | **≈ $0.15**    |
| 3,000 new visitors                      | ~8 GB               | 50,000 PUT          | **≈ $1.50**    |
| 30,000 new visitors                     | ~80 GB              | 500,000 PUT         | **≈ $15**      |

Other costs are close to zero: storage (each deployment ~7 MB), build minutes (none with `npm run deploy` — the build runs on your computer), S3 storage for progress files (~1 KB each). Not included: a custom domain (~$10–15/year) and Route 53 ($0.50 per hosted zone per month).

**Free tier**: AWS accounts created on or after 15 July 2025 get a Free plan with credits ($100, plus up to $100 more for onboarding tasks) for 6 months; older accounts have the 12-month free tier, which covered 15 GB served, 5 GB stored and 1,000 build minutes per month on Amplify. Either way, a low-traffic DevGuru costs **nothing to a few cents** a month.

Set a budget alert anyway: Billing → **Budgets** → Create budget → monthly cost, e.g. **$5**, email alert. Prices change; check https://aws.amazon.com/amplify/pricing/ and https://aws.amazon.com/s3/pricing/.

## 9. Quality checks and CI

Run before every push (CI runs the same):

```bash
npm run validate && npm run typecheck && npm run lint && npx prettier --check . && npm test && npx vite build
```

- **Tests** (Vitest): content structure, search ranking, simulators (Git, Bash, Docker, HTTP, algorithms), Python error formatting and tracing, storage, login sync against a fake S3, code-colour contrast, hosting rules and CSP.
- **Lighthouse mobile** (Step 8, all page types, light and dark): Performance 90–99, Accessibility 100, Best Practices 100, SEO 100.
- **Security headers**: a strict Content-Security-Policy tested in Chrome with Python and SQL running ([docs/deploy.md](docs/deploy.md)).

## 10. Troubleshooting

| Problem                                                 | Fix                                                                                                                                                                                           |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Could not load Python. Check your internet connection" | Pyodide loads from `cdn.jsdelivr.net` the first time; check the connection or a firewall. If you changed `customHttp.yml`, keep `https://cdn.jsdelivr.net` in `script-src` and `connect-src`. |
| Refreshing `/track/...` on the live site gives 404      | the rewrite rule is missing: paste `amplify-rules.json` in Amplify → Rewrites and redirects (or run `npm run deploy`).                                                                        |
| Live site still shows the old version                   | the service worker shows "New content is available → Refresh"; or hard-reload (Ctrl+Shift+R).                                                                                                 |
| Search / Cheat sheets error in `npm run dev` on Windows | fixed in `src/build/contentPlugin.ts`; stop the dev server, delete `node_modules/.vite`, run `npm run dev` again.                                                                             |
| Login: "The progress store refused the save (HTTP 403)" | the bucket policy or CORS is not applied: run the commands in [docs/login.md](docs/login.md). A 403 on the **first** lookup of a new user is normal.                                          |
| `npm run deploy`: "AWS CLI not found" / access denied   | install AWS CLI v2; use `-- --profile <name>`; the user needs Amplify permissions.                                                                                                            |
| Content check fails                                     | it prints the file and the reason: usually a title that does not match `index.json`, a summary with `: ` that needs quotes, or a bare `<word>` / `{ }` in text.                               |

---

**Docs**: [docs/deploy.md](docs/deploy.md) (all deploy options, CSP, caching) · [docs/login.md](docs/login.md) (login, bucket setup, security) · [docs/syllabus.md](docs/syllabus.md) (all topics) · [infra/README.md](infra/README.md) (CDK)
