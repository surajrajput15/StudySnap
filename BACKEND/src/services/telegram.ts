import { env } from '../config/env';

export interface AlertField {
  label: string;
  value: string;
}

export interface TelegramAlert {
  badge: '🟢' | '🤖' | '🚨' | '🔴' | '🛡️' | '📊' | '⚡' | '🔐' | '🚪';
  title: string;
  fields: AlertField[];
  footer?: string;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Escapes characters for Telegram HTML mode.
 */
export function escapeHtml(text: string | number | undefined | null): string {
  if (text === undefined || text === null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const userEmailCache = new Map<string, string>();

/**
 * Creates an anonymized user reference from Clerk ID or other identifier.
 * Example: 'user_2tX8F21' -> 'USR-8F21'
 */
export function maskUserRef(userId: string | undefined | null): string {
  if (!userId) return 'USR-ANON';
  const clean = userId.replace(/^(?:user_)+/i, '').replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length <= 6) return `USR-${clean.toUpperCase()}`;
  return `USR-${clean.slice(-6).toUpperCase()}`;
}

/**
 * Formats a TelegramAlert object into clean, human-readable Telegram HTML message.
 */
export function formatAlertMessage(alert: TelegramAlert): string {
  const header = `<b>${alert.badge} ${escapeHtml(alert.title)}</b>`;
  const fieldLines = alert.fields
    .map((f) => `<b>${escapeHtml(f.label)}:</b> <code>${escapeHtml(f.value)}</code>`)
    .join('\n');
  const footerLine = alert.footer ? `\n<i>${escapeHtml(alert.footer)}</i>` : '';

  return `${header}\n\n${fieldLines}${footerLine}`;
}

// Queue item definition
interface QueueItem {
  id: string;
  message: string;
  chatId?: string;
  retries: number;
  addedAt: number;
}

const queue: QueueItem[] = [];
let isProcessingQueue = false;
const MAX_QUEUE_SIZE = 500;
const MAX_RETRIES = 3;

/**
 * Direct Telegram API call to sendMessage.
 */
export async function sendDirectTelegramMessage(
  text: string,
  targetChatId?: string,
  parseMode: 'HTML' | 'Markdown' = 'HTML'
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = targetChatId || env.TELEGRAM_CHAT_ID;

  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }
  if (!chatId) {
    return { success: false, error: 'TELEGRAM_CHAT_ID not configured' };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      result?: { message_id: number };
      description?: string;
      parameters?: { retry_after?: number };
    };

    if (data.ok && data.result) {
      return { success: true, messageId: data.result.message_id };
    }

    return {
      success: false,
      error: data.description || `HTTP ${res.status} from Telegram API`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

/**
 * Worker that pulls messages from the in-memory queue and dispatches them safely.
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue || queue.length === 0) return;
  isProcessingQueue = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      const result = await sendDirectTelegramMessage(item.message, item.chatId);

      if (!result.success) {
        console.warn(`[telegram] ⚠️ Delivery attempt failed: ${result.error}`);
        if (item.retries < MAX_RETRIES) {
          item.retries += 1;
          const backoffMs = Math.min(1000 * Math.pow(2, item.retries), 10000);
          await new Promise((r) => setTimeout(r, backoffMs));
          queue.push(item);
        } else {
          console.error(`[telegram] ❌ Message dropped after ${MAX_RETRIES} retries`);
        }
      }

      // Small throttling delay to conform to Telegram rate limits (~20 msgs/min per chat)
      await new Promise((r) => setTimeout(r, 60));
    }
  } catch (err) {
    console.error('[telegram] Queue processing error:', err);
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Non-blocking dispatch to send a formatted alert card to Telegram.
 */
export function enqueueTelegramAlert(alert: TelegramAlert, targetChatId?: string): void {
  if (!env.TELEGRAM_ALERTS_ENABLED) return;
  const chatId = targetChatId || env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const formatted = formatAlertMessage(alert);

  if (queue.length >= MAX_QUEUE_SIZE) {
    console.warn('[telegram] ⚠️ Queue full, dropping oldest message');
    queue.shift();
  }

  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message: formatted,
    chatId: targetChatId,
    retries: 0,
    addedAt: Date.now(),
  });

  // Trigger non-blocking worker
  void processQueue();
}

/**
 * Exported queue helper for tests.
 */
export function getTelegramQueueStatus(): { queueLength: number; isProcessing: boolean } {
  return {
    queueLength: queue.length,
    isProcessing: isProcessingQueue,
  };
}

export function clearTelegramQueue(): void {
  queue.length = 0;
}
