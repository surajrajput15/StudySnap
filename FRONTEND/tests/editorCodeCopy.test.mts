import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCodeBlockHtml,
  extractCodeBlockText,
  copyCodeToClipboard,
} from '../lib/editorCode.ts';

// Day 9 Task 11 — the code-block Copy button used an inline `onclick` in the
// inserted HTML. DOMPurify strips event-handler attributes when a saved note is
// reloaded, so the button silently lost its handler. Copying now happens via a
// live delegated listener; the markup itself must stay inert.

test('code-block markup no longer embeds an inline onclick handler', () => {
  const html = buildCodeBlockHtml('js');
  assert.ok(!html.includes('onclick'), 'inline event handlers are stripped by DOMPurify on reload');
  assert.ok(!html.includes('<script'), 'no inline scripts allowed');
});

test('code-block markup keeps the copy button and code structure', () => {
  const html = buildCodeBlockHtml('python');
  assert.ok(html.includes('class="editor-code-copy"'));
  assert.ok(html.includes('<pre><code class="language-python">'));
  assert.ok(html.includes('Copy'));
});

test('language tokens are scrubbed so they cannot inject markup', () => {
  const html = buildCodeBlockHtml('"><img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('onerror='), 'cannot form an event-handler attribute');
  assert.ok(
    html.includes('class="language-imgsrcxonerroralert1"'),
    'token is scrubbed to a bare alphanumeric word inside a well-formed attribute',
  );
  assert.ok(html.includes('class="editor-code-copy"'), 'structure stays intact after scrubbing');
});

test('extractCodeBlockText reads the code from the pre following the header', () => {
  const button = {
    parentElement: {
      nextElementSibling: { textContent: 'const a = 1;\nconsole.log(a);' },
    },
  };
  assert.equal(extractCodeBlockText(button), 'const a = 1;\nconsole.log(a);');
});

test('extractCodeBlockText is safe with a detached/missing structure', () => {
  assert.equal(extractCodeBlockText(null), '');
  assert.equal(extractCodeBlockText(undefined), '');
  assert.equal(extractCodeBlockText({}), '');
  assert.equal(extractCodeBlockText({ parentElement: {} }), '');
});

test('copyCodeToClipboard uses the primary path when available', async () => {
  let written = '';
  const ok = await copyCodeToClipboard('code', {
    write: async (text) => { written = text; },
    fallbackWrite: () => { throw new Error('fallback must not run'); },
  });
  assert.equal(ok, true);
  assert.equal(written, 'code');
});

test('copyCodeToClipboard falls back when the primary path is rejected', async () => {
  let fallbackRan = false;
  const ok = await copyCodeToClipboard('code', {
    write: async () => { throw new Error('denied'); },
    fallbackWrite: (text) => { fallbackRan = text === 'code'; return true; },
  });
  assert.equal(ok, true);
  assert.equal(fallbackRan, true);
});

test('copyCodeToClipboard reports failure when both paths fail', async () => {
  const ok = await copyCodeToClipboard('code', {
    write: async () => { throw new Error('denied'); },
    fallbackWrite: () => false,
  });
  assert.equal(ok, false);
});

test('copyCodeToClipboard reports failure when no path exists', async () => {
  assert.equal(await copyCodeToClipboard('code', {}), false);
});