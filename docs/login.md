# Login and online progress

DevGuru works for **guests** by default: progress is saved in the browser only. A learner can **log in with a phone number or a username** to keep the same progress on every device. There is no backend: each learner's progress is one JSON file in the S3 bucket **`com.shubham.devguru`** (Mumbai, `ap-south-1`), read with `GET` and saved with `PUT` straight from the browser.

## How it works

| Step                         | What happens                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Log in                       | The input is normalised (`+91 98765 43210`, `09876543210` and `9876543210` are the same person; usernames are lower-case). The app hashes it (SHA-256) and reads `progress/<hash>.json`.                     |
| First login                  | No file yet → a new file is created with the guest progress on this device.                                                                                                                                  |
| Later logins / other devices | The file is loaded. Guest progress on that device is **added** to it (topics and bookmarks joined, the better quiz score kept).                                                                              |
| While logged in              | Every change (mark complete, quiz, bookmark, reset, restore) is saved about 2 seconds later. Coming back to the tab (after 15 s or more), going online, or **Sync now** pulls changes made on other devices. |
| Offline                      | Changes wait on the device and are uploaded when the network is back (automatic retry every 30 s).                                                                                                           |
| Log out                      | Unsaved changes are uploaded first, then this device goes back to an empty guest. The progress stays online.                                                                                                 |

Sync rule: changes on this device are uploaded; a file changed by another device is downloaded; if both happened, they are merged. Un-ticking a topic on one device is therefore not undone by another.

File in S3 (no phone number or username inside, and the file name is a hash):

```json
{
  "app": "devguru",
  "format": 1,
  "updatedAt": "2026-11-15T14:05:09.120Z",
  "data": {
    "version": 1,
    "completed": ["sql/sql-inner-join"],
    "quizScores": {},
    "bookmarks": [],
    "lastVisited": null
  }
}
```

Code: `src/utils/identity.ts` (normalise + hash), `src/utils/cloudSync.ts` (GET/PUT, sync, login, logout), `src/utils/mergeProgress.ts`, `src/components/account/` (header button, dialog, progress-page card). Tests: `tests/cloudSync.test.ts` (fake S3 with the same 403 behaviour).

## Set up the bucket (once)

The configuration is in `infra/progress-bucket/`:

| File                       | What it does                                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public-access-block.json` | allows a public **bucket policy**, keeps public **ACLs** blocked                                                                                   |
| `ownership.json`           | `BucketOwnerEnforced`: you own every uploaded file; ACLs are off                                                                                   |
| `bucket-policy.json`       | anyone may `GetObject` on `progress/*` and `PutObject` on `progress/*.json`; nothing else (no list, no delete); HTTPS only                         |
| `cors.json`                | the site (`https://main.d2b6t6o0frsg93.amplifyapp.com`) and local dev (`localhost:5173`, `localhost:4173`) may call the bucket with GET, PUT, HEAD |
| `lifecycle.json`           | old versions are kept 30 days, then deleted                                                                                                        |

macOS / Linux / Git Bash:

```bash
cd infra/progress-bucket
bash setup.sh
```

Windows PowerShell (same steps, run in `infra\progress-bucket`):

```powershell
$B = "com.shubham.devguru"
aws s3api create-bucket --bucket $B --region ap-south-1 --create-bucket-configuration LocationConstraint=ap-south-1   # skip if it exists
aws s3api put-bucket-ownership-controls --bucket $B --ownership-controls file://ownership.json
aws s3api put-public-access-block --bucket $B --public-access-block-configuration file://public-access-block.json
aws s3api put-bucket-policy --bucket $B --policy file://bucket-policy.json
aws s3api put-bucket-cors --bucket $B --cors-configuration file://cors.json
aws s3api put-bucket-versioning --bucket $B --versioning-configuration Status=Enabled
aws s3api put-bucket-lifecycle-configuration --bucket $B --lifecycle-configuration file://lifecycle.json
```

Check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://s3.ap-south-1.amazonaws.com/com.shubham.devguru/progress/test.json
# 403 = no such file (S3 says 403, not 404, when listing is not allowed) — that is correct
```

The order matters: the public access block must allow public policies **before** `put-bucket-policy`, or AWS rejects the policy.

The same configuration in the console: S3 → `com.shubham.devguru` → Permissions → Block public access → Edit → untick only the two "bucket policies" boxes; Bucket policy → paste `bucket-policy.json`; CORS → paste the `CORSRules` list from `cors.json`; Object Ownership → ACLs disabled; Properties → Bucket Versioning → Enable; Management → Lifecycle rule as in `lifecycle.json`.

## Why the URL is path-style

The bucket name has dots. HTTPS certificates for `*.s3.ap-south-1.amazonaws.com` cover one name level, so `https://com.shubham.devguru.s3.ap-south-1.amazonaws.com` fails in browsers. The app uses `https://s3.ap-south-1.amazonaws.com/com.shubham.devguru/...` (`src/config/cloud.ts`), which works for this bucket. A bucket name **without dots** (for example `devguru-progress`) could use either style.

## Changing things

| Change                               | Where                                                                                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Another bucket / CloudFront in front | `VITE_PROGRESS_BASE_URL=https://...` in `.env` (or `DEFAULT_BASE_URL` in `src/config/cloud.ts`), **and** add its origin to `connect-src` in `customHttp.yml` (a test checks the default one) |
| Turn login off                       | `VITE_PROGRESS_BASE_URL=` (empty): the header button and progress card disappear; guests work as before                                                                                      |
| New site address (custom domain)     | add it to `AllowedOrigins` in `cors.json` and run `put-bucket-cors` again                                                                                                                    |

## Security: what this design does and does not protect

This is a convenience feature for learning progress, not an account system. It is safe enough for that because the data is low value, but know the limits:

- **No password or OTP.** Anyone who types the same phone number or username can see and change that progress. The dialog says so.
- **The bucket is writable by anyone on the internet** under `progress/*.json`. CORS only limits browsers; scripts can still PUT. Someone could overwrite a learner's file (versioning lets you restore it: S3 → the file → Versions) or upload junk files (storage and request costs).
- What is protected: no listing (nobody can see which files exist), no deleting, no ACLs, HTTPS only, nothing outside `progress/`, and phone numbers never appear in file names, URLs or file contents. (A hash of a phone number can be guessed by trying numbers, but only by someone who already has the file name, and listing is off.)

Recommended:

1. **AWS Budgets** alert on the account (Billing → Budgets → monthly cost budget, e.g. $5, email alert) to notice abuse early.
2. Keep this bucket for progress files only; do not put anything else in it.
3. To make it a real login later, put a small backend in front (API Gateway + Lambda with phone OTP via Amazon SNS or Cognito) and remove the public PUT from the bucket policy. The app only needs `fetchProgress` and `uploadProgress` in `cloudSync.ts` changed.
