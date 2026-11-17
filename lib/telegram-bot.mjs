#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(path) {
  let content
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return
  }

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || match[2].startsWith('#')) continue
    const value = match[2].replace(/^(['"])(.*)\1$/, '$2')
    process.env[match[1]] ??= value
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN. Set it in the environment or .env.local.')
  process.exit(1)
}

const allowedChats = new Set(
  (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
)
if (!allowedChats.size) {
  console.error('Missing TELEGRAM_ALLOWED_CHAT_IDS. Set your Telegram chat ID(s) before starting the bot.')
  process.exit(1)
}

const api = `https://api.telegram.org/bot${token}`
let offset = 0
let stopping = false

async function telegram(method, body, timeout = 40_000) {
  const response = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.description || `Telegram API returned HTTP ${response.status}`)
  }
  return result.result
}

async function reply(chatId, text) {
  await telegram('sendMessage', { chat_id: chatId, text })
}

async function handleUpdate(update) {
  const message = update.message
  const text = message?.text?.trim()
  if (!text || !message.chat?.id) return

  const chatId = String(message.chat.id)
  if (!allowedChats.has(chatId)) {
    console.warn(`Ignored message from an unapproved Telegram chat (${chatId}).`)
    return
  }

  const command = text.split(/\s+/, 1)[0].split('@', 1)[0].toLowerCase()
  if (command === '/start') {
    await reply(chatId, 'Merhaba! Telegram botu hazır. /help komutuyla kullanılabilir komutları görebilirsiniz.')
  } else if (command === '/help') {
    await reply(chatId, 'Komutlar:\n/start — botu başlat\n/help — yardım\n/status — çalışma durumunu göster')
  } else if (command === '/status') {
    await reply(chatId, 'Bot çevrimiçi ve mesaj almaya hazır.')
  } else if (!text.startsWith('/')) {
    await reply(chatId, 'Mesajınız alındı. Bu temel entegrasyonda henüz bir uygulama/AI yanıtlayıcısı bağlı değil.')
  }
}

async function poll() {
  while (!stopping) {
    try {
      const updates = await telegram('getUpdates', {
        offset,
        timeout: 30,
        allowed_updates: ['message'],
      })

      for (const update of updates) {
        offset = update.update_id + 1
        try {
          await handleUpdate(update)
        } catch (error) {
          console.error('Could not process Telegram update:', error.message)
        }
      }
    } catch (error) {
      if (!stopping) {
        console.error('Telegram polling failed:', error.message)
        await new Promise((resolve) => setTimeout(resolve, 3_000))
      }
    }
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    stopping = true
    console.log('Stopping Telegram bot.')
  })
}

try {
  const me = await telegram('getMe', {}, 10_000)
  await telegram('setMyCommands', {
    commands: [
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show available commands' },
      { command: 'status', description: 'Check bot status' },
    ],
  }, 10_000)
  console.log(`Telegram bot @${me.username} is running. Approved chats: ${allowedChats.size}.`)
  await poll()
} catch (error) {
  console.error('Telegram bot stopped:', error.message)
  process.exitCode = 1
}
