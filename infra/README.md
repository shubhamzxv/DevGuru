# DevGuru infrastructure (AWS CDK, optional)

Two stacks. Neither is needed for `npm run deploy`, which publishes to Amplify Hosting with your own AWS login.

| Stack                 | What it creates                                                                                                                                                       | When you need it                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `DevGuruGithubDeploy` | GitHub OIDC provider + an IAM role that may only publish to the Amplify app in `cdk.json`                                                                             | to let the **Deploy** GitHub Actions workflow deploy without stored AWS keys |
| `DevGuruSite`         | private S3 bucket + CloudFront (Origin Access Control, HTTP/2+3, gzip/brotli), the same security headers (`../customHttp.yml`) and SPA rule (`../amplify-rules.json`) | only if you move off Amplify Hosting                                         |

## Progress bucket (login)

`progress-bucket/` holds the S3 configuration for the public progress bucket `com.shubham.devguru` used by login (`bash progress-bucket/setup.sh`). It is plain AWS CLI, not CDK, because the bucket already exists. Details and risks: `../docs/login.md`.

## Setup (once)

```bash
cd infra
npm install
npx cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1   # once per account and region
```

Settings are in `cdk.json` → `context` (or pass `-c key=value`):

| Key                            | Meaning                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `githubRepo`                   | `owner/repo` allowed to assume the deploy role                                                                                  |
| `amplifyAppId`                 | the app in `../deploy.config.json`                                                                                              |
| `githubOidcProviderArn`        | leave empty; set it only if your account already has a `token.actions.githubusercontent.com` provider (an account can have one) |
| `domainName`, `certificateArn` | optional custom domain for `DevGuruSite` (certificate must be in **us-east-1**)                                                 |

## GitHub deploy role

```bash
npm run deploy:github-role
```

Copy the `DeployRoleArn` output to GitHub → Settings → Secrets and variables → Actions → **Variables** → `AWS_DEPLOY_ROLE_ARN`. From then on, every green CI run on `main` deploys.

## S3 + CloudFront hosting (alternative to Amplify)

```bash
cd .. && npm run build && cd infra
npm run deploy:site
```

Hashed files in `assets/` get `Cache-Control: public, max-age=31536000, immutable`; everything else `no-cache`. Old asset files are kept so open tabs keep working. `index.html`, `sw.js`, the manifest and `theme-init.js` are invalidated on every deploy.

## Checks

```bash
npm test            # runs the generated CloudFront Function on sample URLs
npx cdk synth       # builds the CloudFormation templates without deploying
```
