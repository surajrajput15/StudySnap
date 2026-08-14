/**
 * Day 9 Task 2 — client-side PDF text extraction for the AI attachment flow.
 *
 * Reading a PDF with `file.text()` yields binary garbage, so attachments use
 * pdfjs-dist here. pdf.js normally boots a dedicated Web Worker, but that
 * worker file is awkward to serve through the bundler and the site CSP. pdf.js
 * explicitly supports running on the main thread: when
 * `globalThis.pdfjsWorker.WorkerMessageHandler` is present it skips the Web
 * Worker and sets up an in-process handler, so nothing extra is fetched and
 * `worker-src 'self' blob:` is never exercised. Eval is disabled too
 * (`isEvalSupported: false`) because the CSP never allows `unsafe-eval`.
 * Every failure path rejects so callers surface a clear "could not read this
 * file" message instead of a fake attachment.
 */

/** Extracts the text of every page of a PDF file. Rejects when the file is not
 *  a readable PDF so the caller can show an honest error. */

/**
 * Day 10 Task 8 — cap how many pages are read. Extraction runs on the main
 * thread page-by-page, so a 500-page PDF would freeze the UI for minutes.
 * Reading the first MAX_PDF_PAGES pages and flagging the rest keeps the flow
 * responsive and tells the user the output was partial.
 */
export const MAX_PDF_PAGES = 100;

export const PDF_PAGE_TRUNCATION_NOTICE =
  `\n\n[PDF truncated: only the first ${MAX_PDF_PAGES} pages were read.]`;

export async function extractTextFromPdf(file: File): Promise<string> {
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs'),
  ]);

  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;

  const data = await file.arrayBuffer();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (err) {
    // Day 10 Task 8 — surface password-protected PDFs specifically instead of
    // the raw pdf.js failure, so the caller can show a fixable message.
    const e = err as { name?: string; message?: string };
    if (e?.name === 'PasswordException' || (e?.message ?? '').toLowerCase().includes('password')) {
      throw new Error('This PDF is password-protected. Remove the password and try again.');
    }
    throw err;
  }
  try {
    const pages: string[] = [];
    const pageCount = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let pageIndex = 1; pageIndex <= pageCount; pageIndex++) {
      const page = await doc.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => (item as { str?: unknown }).str)
        .filter((s): s is string => typeof s === 'string')
        .join(' ');
      pages.push(pageText);
    }
    const text = pages.join('\n').trim();
    return doc.numPages > MAX_PDF_PAGES ? `${text}${PDF_PAGE_TRUNCATION_NOTICE}`.trim() : text;
  } finally {
    try {
      await doc.destroy();
    } catch {
      /* best-effort cleanup */
    }
  }
}
