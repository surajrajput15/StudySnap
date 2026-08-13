/**
 * Day 9 Task 11 — editor code-block copy, fixed for reloads.
 *
 * The old implementation embedded an inline `onclick` attribute inside the
 * inserted HTML. It worked in the live session but silently died after a reload
 * or note re-open: every saved note is run through DOMPurify.sanitize() on load,
 * and DOMPurify strips event-handler attributes, so the button came back with no
 * handler. The fix keeps the DOM inert (no inline script) and copies through a
 * live delegated listener, so freshly inserted AND reloaded code blocks behave
 * identically.
 */

/** Builds the code-block HTML with an inert copy button (no inline `onclick`).
 *  The language token is scrubbed so it can never inject markup. */
export function buildCodeBlockHtml(lang: string): string {
  const safeLang = lang.replace(/[^a-zA-Z0-9+#-]/g, '');
  return (
    '<div class="editor-code-block"><div class="editor-code-header">' +
    `<span>${safeLang}</span>` +
    '<button type="button" class="editor-code-copy" aria-label="Copy code to clipboard">Copy</button>' +
    `</div><pre><code class="language-${safeLang}"> </code></pre></div>`
  );
}

/** Minimal structural view of the copy button for extraction (matches the real
 *  DOM: button → parent (.editor-code-header) → next sibling (<pre>)). */
export interface CodeBlockButtonLike {
  parentElement?: { nextElementSibling?: { textContent?: string | null } | null } | null;
}

/** Reads the code text a copy button refers to: `btn.parentElement.nextElementSibling.textContent`. */
export function extractCodeBlockText(button: CodeBlockButtonLike | null | undefined): string {
  return button?.parentElement?.nextElementSibling?.textContent ?? '';
}

/** Clipboard-write environment, injectable for tests. */
export interface CopyCodeEnv {
  /** Primary path (navigator.clipboard.writeText in the browser). */
  write?: (text: string) => Promise<void> | void;
  /** Fallback path (execCommand copy in the browser). Returns success. */
  fallbackWrite?: (text: string) => boolean;
}

/** Copies `code` via the primary path, falling back when unavailable or rejected.
 *  Returns true when either path succeeded. */
export async function copyCodeToClipboard(
  code: string,
  env: CopyCodeEnv = {},
): Promise<boolean> {
  if (env.write) {
    try {
      await env.write(code);
      return true;
    } catch {
      // fall through to the fallback path
    }
  }
  return env.fallbackWrite ? env.fallbackWrite(code) : false;
}