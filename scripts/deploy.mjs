// Deploys the site to AWS Amplify Hosting from your terminal.
//
//   npm run deploy                  build + upload + publish
//   npm run deploy -- --dry-run     build + make the zip, but do not touch AWS
//   npm run deploy -- --skip-build  upload the dist/ folder that already exists
//   npm run deploy -- --profile dev use the AWS profile called "dev" for this run
//
// Needs: AWS CLI v2 installed and logged in (aws configure). Settings: deploy.config.json
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(root, 'deploy.config.json');
const distDir = join(root, 'dist');
const dryRun = process.argv.includes('--dry-run');
const skipBuild = process.argv.includes('--skip-build');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

// Which AWS login to use. Order: --profile <name> on the command line,
// then "profile" in deploy.config.json, then the AWS_PROFILE variable / default profile.
const profileFlag = process.argv.indexOf('--profile');
const profile = (profileFlag >= 0 ? process.argv[profileFlag + 1] : undefined) ?? config.profile;
const profileArgs = profile ? ['--profile', profile] : [];

// Every route without a file extension goes to index.html (React Router handles it).
// Real files (.js, .css, .wasm, .json, images, fonts...) are served as they are.
// Kept in amplify-rules.json so the same rule can be pasted into the Amplify console.
const SPA_RULE = JSON.parse(readFileSync(join(root, 'amplify-rules.json'), 'utf8'));

function step(text) {
  console.log(`\n▶ ${text}`);
}

function fail(text) {
  console.error(`\n✖ ${text}`);
  process.exit(1);
}

/** Runs one AWS CLI command and returns its JSON answer. */
function aws(args) {
  try {
    const out = execFileSync(
      'aws',
      [...args, '--region', config.region, '--output', 'json', ...profileArgs],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return out.trim() ? JSON.parse(out) : {};
  } catch (error) {
    const reason = (error.stderr || error.message || '').toString().trim();
    throw new Error(reason || 'AWS CLI command failed');
  }
}

// ---------- tiny zip writer (no extra npm package needed) ----------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** All files under dir, as paths with forward slashes (zip files need "/"). */
function listFiles(dir, prefix = '') {
  return readdirSync(join(dir, prefix))
    .sort()
    .flatMap((name) => {
      const relative = prefix ? `${prefix}/${name}` : name;
      return statSync(join(dir, relative)).isDirectory() ? listFiles(dir, relative) : [relative];
    });
}

function makeZip(dir) {
  const fileParts = [];
  const centralParts = [];
  let offset = 0;
  const files = listFiles(dir);

  for (const name of files) {
    const data = readFileSync(join(dir, name));
    const compressed = deflateRawSync(data, { level: 9 });
    const nameBytes = Buffer.from(name, 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // file names are UTF-8
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x21, 12); // date: 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    fileParts.push(local, nameBytes, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42); // where this file starts in the zip
    centralParts.push(central, nameBytes);

    offset += local.length + nameBytes.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);

  return { zip: Buffer.concat([...fileParts, centralDirectory, end]), count: files.length };
}

// ---------- Amplify ----------

function findOrCreateApp() {
  const headers = readFileSync(join(root, 'customHttp.yml'), 'utf8');
  const rules = JSON.stringify(SPA_RULE);
  let appId = config.appId;

  if (!appId) {
    const existing = aws(['amplify', 'list-apps']).apps?.find((app) => app.name === config.appName);
    if (existing) {
      appId = existing.appId;
      console.log(`  Found Amplify app "${config.appName}" (${appId})`);
    } else {
      appId = aws(['amplify', 'create-app', '--name', config.appName, '--platform', 'WEB']).app
        .appId;
      console.log(`  Created Amplify app "${config.appName}" (${appId})`);
    }
    config.appId = appId;
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log('  Saved the app id in deploy.config.json');
  }

  // Keep the rewrite rule and the headers in sync on every deploy.
  const app = aws([
    'amplify',
    'update-app',
    '--app-id',
    appId,
    '--custom-rules',
    rules,
    '--custom-headers',
    headers,
  ]).app;

  try {
    aws(['amplify', 'get-branch', '--app-id', appId, '--branch-name', config.branch]);
  } catch {
    aws([
      'amplify',
      'create-branch',
      '--app-id',
      appId,
      '--branch-name',
      config.branch,
      '--stage',
      'PRODUCTION',
    ]);
    console.log(`  Created branch "${config.branch}"`);
  }

  return app;
}

async function publish(app, zip) {
  const target = ['--app-id', app.appId, '--branch-name', config.branch];
  const { jobId, zipUploadUrl } = aws(['amplify', 'create-deployment', ...target]);

  const upload = await fetch(zipUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip' },
    body: zip,
  });
  if (!upload.ok) throw new Error(`Upload failed with HTTP ${upload.status}`);

  aws(['amplify', 'start-deployment', ...target, '--job-id', jobId]);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const status = aws(['amplify', 'get-job', ...target, '--job-id', jobId]).job.summary.status;
    process.stdout.write(`  ${status}        \r`);
    if (status === 'SUCCEED') return;
    if (status === 'FAILED' || status === 'CANCELLED') {
      throw new Error(`Amplify job ${jobId} ended with status ${status}`);
    }
  }
  throw new Error(`Amplify job ${jobId} is still running. Check it in the AWS console.`);
}

// ---------- main ----------

if (!dryRun) {
  step('Checking AWS CLI and login');
  try {
    execFileSync('aws', ['--version'], { stdio: 'ignore' });
  } catch {
    fail('AWS CLI not found. Install AWS CLI v2, then run: aws configure');
  }
  try {
    const identity = aws(['sts', 'get-caller-identity']);
    console.log(
      `  Account ${identity.Account}, region ${config.region}, profile ${profile ?? '(default)'}`,
    );
  } catch (error) {
    fail(
      `Cannot log in to AWS${profile ? ` with profile "${profile}"` : ''}. Check: aws configure list-profiles\n  ${error.message}`,
    );
  }
}

if (!skipBuild) {
  step('Building (content check, typecheck, vite build)');
  try {
    execSync('npm run build', { cwd: root, stdio: 'inherit' });
  } catch {
    fail('Build failed. Nothing was deployed.');
  }
}
if (!existsSync(join(distDir, 'index.html')))
  fail('dist/index.html not found. Run the build first.');

step('Zipping dist/');
const { zip, count } = makeZip(distDir);
console.log(`  ${count} files, ${(zip.length / 1024 / 1024).toFixed(2)} MB`);

if (dryRun) {
  const out = join(root, 'dist.zip');
  writeFileSync(out, zip);
  console.log(`\n✔ Dry run finished. Zip saved as dist.zip. Nothing was sent to AWS.`);
  process.exit(0);
}

try {
  step(`Preparing Amplify app "${config.appName}"`);
  const app = findOrCreateApp();

  step('Uploading and publishing');
  await publish(app, zip);

  console.log(`\n✔ Deployed: https://${config.branch}.${app.defaultDomain}`);
} catch (error) {
  fail(error.message);
}
