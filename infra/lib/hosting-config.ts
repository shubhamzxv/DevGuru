import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/**
 * The CDK stack reuses the Amplify files, so headers and the SPA rule are written once:
 *   ../customHttp.yml      → CloudFront response headers + Cache-Control per path
 *   ../amplify-rules.json  → CloudFront Function that sends app routes to /index.html
 */
const projectRoot = join(__dirname, '..', '..');

interface HeaderPattern {
  pattern: string;
  headers: { key: string; value: string }[];
}

export function siteHeaders(): Record<string, string> {
  const file = parse(readFileSync(join(projectRoot, 'customHttp.yml'), 'utf8')) as {
    customHeaders: HeaderPattern[];
  };
  const all = file.customHeaders.find((entry) => entry.pattern === '**/*');
  if (!all) throw new Error("customHttp.yml has no '**/*' pattern");
  return Object.fromEntries(all.headers.map((header) => [header.key, String(header.value)]));
}

/** The regex from amplify-rules.json, without Amplify's </ ... /> wrapper. */
export function spaRewritePattern(): string {
  const rules = JSON.parse(readFileSync(join(projectRoot, 'amplify-rules.json'), 'utf8')) as {
    source: string;
    target: string;
  }[];
  const rule = rules.find((r) => r.target === '/index.html');
  if (!rule) throw new Error('amplify-rules.json has no rule targeting /index.html');
  return rule.source.replace(/^<\//, '').replace(/\/>$/, '');
}

/** CloudFront Function (viewer request): app routes → /index.html, real files unchanged. */
export function spaRewriteFunctionCode(): string {
  return `
var SPA_ROUTE = new RegExp(${JSON.stringify(spaRewritePattern())});
function handler(event) {
  var request = event.request;
  if (SPA_ROUTE.test(request.uri)) {
    request.uri = '/index.html';
  }
  return request;
}`.trim();
}

export const distDir = join(projectRoot, 'dist');
