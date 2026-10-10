import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8904396966:AAEB4vvPVWl64x2UBrLG5WIEJgMjNwmJYBQ';

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║       StudySnap — Telegram Monitoring Setup            ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  console.log(`[setup] 🔍 Verifying Bot Token: ${BOT_TOKEN.slice(0, 10)}...`);

  // 1. Verify Bot Token via getMe
  const meRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
  const meData = (await meRes.json()) as { ok: boolean; result?: { username: string; first_name: string } };

  if (!meData.ok || !meData.result) {
    console.error('❌ Failed to connect to Telegram Bot. Please verify your token.');
    process.exit(1);
  }

  console.log(`[setup] ✅ Bot Connected: @${meData.result.username} (${meData.result.first_name})`);

  // Check command-line arg for manual chat ID
  const manualArg = process.argv.find((a) => a.startsWith('--chat-id=') || a === '-c');
  let targetChatId = manualArg
    ? manualArg.replace('--chat-id=', '')
    : process.env.TELEGRAM_CHAT_ID;

  if (!targetChatId) {
    console.log('[setup] 🔍 Checking for incoming messages / /start from Telegram...');
    const updatesRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-10`);
    const updatesData = (await updatesRes.json()) as {
      ok: boolean;
      result: Array<{
        message?: {
          chat: { id: number; username?: string; first_name?: string; type: string };
          from?: { id: number; username?: string; first_name?: string };
          text?: string;
        };
      }>;
    };

    if (updatesData.ok && updatesData.result && updatesData.result.length > 0) {
      // Pick the newest message
      const latest = updatesData.result[updatesData.result.length - 1];
      if (latest.message?.chat?.id) {
        targetChatId = String(latest.message.chat.id);
        const sender = latest.message.from?.username || latest.message.from?.first_name || 'User';
        console.log(`[setup] 🎯 Detected Chat ID: ${targetChatId} from @${sender}`);
      }
    }
  }

  if (!targetChatId) {
    console.log('\n⚠️  No incoming messages found yet.');
    console.log('👉 ACTION REQUIRED:');
    console.log('   1. Open Telegram and search for: @StudySnapAlerts_Bot');
    console.log('      (Direct link: https://t.me/StudySnapAlerts_Bot)');
    console.log('   2. Click "Start" or send any message (e.g. /start)');
    console.log('   3. Run this script again to automatically link your chat!\n');
    console.log('   (Alternative: run with `npm run telegram:init -- --chat-id=YOUR_CHAT_ID`)\n');
    return;
  }

  // 2. Save TELEGRAM_CHAT_ID to .env
  try {
    const envPath = resolve(__dirname, '../../.env');
    let envContent = readFileSync(envPath, 'utf-8');
    if (envContent.includes('TELEGRAM_CHAT_ID=')) {
      envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/, `TELEGRAM_CHAT_ID=${targetChatId}`);
    } else {
      envContent += `\nTELEGRAM_CHAT_ID=${targetChatId}\n`;
    }
    writeFileSync(envPath, envContent, 'utf-8');
    console.log(`[setup] 💾 Saved TELEGRAM_CHAT_ID=${targetChatId} to .env`);
  } catch (err) {
    console.warn('[setup] ⚠️ Could not update .env automatically:', err);
  }

  // 3. Send Test Verification Alert
  console.log('[setup] 🚀 Sending test alert to Telegram...');
  const testMessage =
    `<b>🟢 StudySnap Monitoring Active</b>\n\n` +
    `<b>Status:</b> <code>Connected successfully</code>\n` +
    `<b>Bot:</b> <code>@${meData.result.username}</code>\n` +
    `<b>Environment:</b> <code>${process.env.NODE_ENV || 'development'}</code>\n\n` +
    `<i>Real-time alerts for student signups, AI features, security events, and backend health are now active!</i>`;

  const sendRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: targetChatId,
      text: testMessage,
      parse_mode: 'HTML',
    }),
  });

  const sendData = (await sendRes.json()) as { ok: boolean; description?: string };
  if (sendData.ok) {
    console.log('🎉 Test alert sent successfully! Check your Telegram chat.');
  } else {
    console.error('❌ Telegram delivery failed:', sendData.description);
  }
}

void main();
