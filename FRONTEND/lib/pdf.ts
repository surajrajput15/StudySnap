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
export async function extractTextFromPdf(file: File): Promise<string> {
  const [pdfjs, workerModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs'),
  ]);

  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    const pages: string[] = [];
    for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex++) {
      const page = await doc.getPage(pageIndex);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => (item as { str?: unknown }).str)
        .filter((s): s is string => typeof s === 'string')
        .join(' ');
      pages.push(pageText);
    }
    return pages.join('\n').trim();
  } finally {
    try {
      await doc.destroy();
    } catch {
      /* best-effort cleanup */
    }
  }
}
