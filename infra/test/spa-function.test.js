// Runs the generated CloudFront Function code with sample requests.
const { test } = require('node:test');
const assert = require('node:assert');
require('ts-node/register/transpile-only');
const { spaRewriteFunctionCode } = require('../lib/hosting-config');

const handler = new Function(`${spaRewriteFunctionCode()}; return handler;`)();
const rewrite = (uri) => handler({ request: { uri } }).uri;

test('app routes go to /index.html', () => {
  for (const uri of [
    '/',
    '/track/python',
    '/track/python/list-vs-tuple',
    '/playground/sql',
    '/no/such/page',
  ]) {
    assert.strictEqual(rewrite(uri), '/index.html', uri);
  }
});

test('real files are served as they are', () => {
  for (const uri of [
    '/assets/index-abc.js',
    '/assets/index-abc.css',
    '/wasm/sql-wasm.wasm',
    '/sw.js',
    '/robots.txt',
    '/manifest.webmanifest',
    '/icons/icon-192.png',
  ]) {
    assert.strictEqual(rewrite(uri), uri, uri);
  }
});
