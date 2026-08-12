/**
 * Day 8 Task 2 Phase 1 (B-7) — AI request log metadata extraction.
 *
 * Extracts ONLY non-content operational metadata from a validated AI request
 * body. User-generated text (chat messages, message.content, note content,
 * prompts, titles, conversation history, transcripts) is deliberately NEVER
 * returned here — only counts, length measures, and safe enum labels.
 * The helper is defensive and never throws on unexpected shapes.
 */
export function aiRequestLogMeta(body: Record<string, unknown>): Record<string, unknown> {
  const meta: Record<string, unknown> = {};

  if (Array.isArray(body.messages)) {
    meta.messageCount = body.messages.length;
  }
  if (typeof body.content === 'string') {
    meta.contentLength = body.content.length;
  }
  if (typeof body.title === 'string') {
    meta.titleLength = body.title.length;
  }
  if (typeof body.targetLanguage === 'string' && /^(hindi|english)$/.test(body.targetLanguage)) {
    meta.targetLanguage = body.targetLanguage;
  }

  return meta;
}