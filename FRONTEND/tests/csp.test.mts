import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionCspHeader, originOf } from '../lib/security/csp.ts';

const BACKEND = 'https://studysnap-api.onrender.com';

/** Directive values of `name` (e.g. "script-src") from a serialized CSP. */
function directive(csp: string, name: string): string {
  const part = csp
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith(name));
  assert.ok(part, `missing directive: ${name}`);
  return part!.slice(name.length).trim();
}

function hasSource(csp: string, name: string, source: string): boolean {
  return directive(csp, name).split(/\s+/).includes(source);
}

test('production CSP never allows unsafe-eval in any directive', () => {
  const csp = buildProductionCspHeader({ backendOrigin: BACKEND });
  assert.ok(!csp.includes("'unsafe-eval'"), 'unsafe-eval is never allowed in production');
});

test('production CSP uses no broad wildcard sources', () => {
  const csp = buildProductionCspHeader({ backendOrigin: BACKEND });
  const tokens = csp.split(/[;\s]+/).filter(Boolean);
  assert.ok(!tokens.includes('https://*'), 'no https://* wildcard source');
  assert.ok(!tokens.includes('http://*'), 'no http://* wildcard source');
  assert.ok(!tokens.includes('*'), 'no bare * source');
  // img-src deliberately allows scheme-only https:/http: so the note editor can
  // display images the user pasted from any host; every other directive must
  // keep an explicit allow-list.
  const nonImg = csp
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith('img-src'))
    .join(';');
  assert.ok(!nonImg.split(/[;\s]+/).includes('https:'), 'no scheme-only https: source outside img-src');
  assert.ok(!nonImg.split(/[;\s]+/).includes('http:'), 'no scheme-only http: source outside img-src');
});

test('locking directives are present and tight', () => {
  const csp = buildProductionCspHeader({ backendOrigin: BACKEND });
  assert.equal(directive(csp, 'default-src'), "'self'");
  assert.equal(directive(csp, 'object-src'), "'none'");
  assert.equal(directive(csp, 'base-uri'), "'self'");
  assert.equal(directive(csp, 'form-action'), "'self'");
  assert.equal(directive(csp, 'frame-ancestors'), "'self'");
  assert.ok(csp.endsWith('upgrade-insecure-requests'), 'upgrades insecure subresources');
});

test('scripts/styles only come from self, Clerk and the bundled Google Fonts', () => {
  const csp = buildProductionCspHeader({ backendOrigin: BACKEND });
  assert.ok(hasSource(csp, 'script-src', "'self'"));
  assert.ok(hasSource(csp, 'script-src', "'unsafe-inline'"));
  assert.ok(hasSource(csp, 'script-src', 'https://js.clerk.com'));
  assert.ok(hasSource(csp, 'script-src', 'https://*.clerk.com'));
  assert.ok(hasSource(csp, 'script-src', 'https://*.clerk.accounts.dev'));
  assert.ok(hasSource(csp, 'script-src', 'https://challenges.cloudflare.com'));
  assert.ok(hasSource(csp, 'style-src', "'unsafe-inline'"));
  assert.ok(hasSource(csp, 'style-src', 'https://fonts.googleapis.com'));
  assert.equal(directive(csp, 'script-src').split(/\s+/).length, 6, 'script-src stays an explicit allow-list');
});

test('Cloudinary audio and Google font files are the only media/font hosts', () => {
  const csp = buildProductionCspHeader({ backendOrigin: BACKEND });
  for (const source of ['blob:', 'https://res.cloudinary.com']) {
    assert.ok(hasSource(csp, 'media-src', source), `media-src allows ${source}`);
  }
  for (const source of ['data:', 'https://fonts.gstatic.com']) {
    assert.ok(hasSource(csp, 'font-src', source), `font-src allows ${source}`);
  }
  assert.ok(hasSource(csp, 'img-src', 'https://img.clerk.com'), 'Clerk avatars load from img.clerk.com');
});

test('connect-src allows the configured backend origin and nothing fabricated', () => {
  const withBackend = buildProductionCspHeader({ backendOrigin: BACKEND });
  assert.ok(hasSource(withBackend, 'connect-src', BACKEND), 'configured backend API origin allowed');

  const withoutBackend = buildProductionCspHeader({ backendOrigin: null });
  assert.ok(!hasSource(withoutBackend, 'connect-src', BACKEND), 'null backend is not injected as a fake source');
  assert.ok(hasSource(withoutBackend, 'connect-src', "'self'"), 'self always allowed');
  assert.ok(hasSource(withoutBackend, 'connect-src', 'https://*.clerk.accounts.dev'), 'Clerk Frontend API always allowed');
});

test('Clerk modal auth iframes are framed only from Clerk and Cloudflare', () => {
  const csp = buildProductionCspHeader({ backendOrigin: BACKEND });
  assert.ok(hasSource(csp, 'frame-src', 'https://*.clerk.accounts.dev'));
  assert.ok(hasSource(csp, 'frame-src', 'https://*.clerk.com'));
  assert.ok(hasSource(csp, 'frame-src', 'https://challenges.cloudflare.com'));
});

test('originOf normalizes URLs and rejects invalid/absent values', () => {
  assert.equal(originOf('https://studysnap-api.onrender.com'), 'https://studysnap-api.onrender.com');
  assert.equal(originOf('https://studysnap-api.onrender.com/api/health'), 'https://studysnap-api.onrender.com');
  assert.equal(originOf('https://studysnap-api.onrender.com/'), 'https://studysnap-api.onrender.com');
  assert.equal(originOf('http://localhost:4000'), 'http://localhost:4000');
  assert.equal(originOf(undefined), null);
  assert.equal(originOf(''), null);
  assert.equal(originOf('not a url'), null);
});