# Telegram bot

The repository includes a small standalone Telegram bot runner at `lib/telegram-bot.mjs`. It uses Telegram's Bot API directly and long-polls for messages; no extra package is required. The initial commands are `/start`, `/help`, and `/status`.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and copy its token.
2. Add the token and your allowed chat ID(s) to the ignored `.env.local` file:

   ```dotenv
   TELEGRAM_BOT_TOKEN=123456:replace-with-your-bot-token
   TELEGRAM_ALLOWED_CHAT_IDS=123456789
   ```

   For more than one approved user/chat, separate IDs with commas. The bot refuses to start without an allowlist and ignores all messages from other chats. Keep the token private; do not commit it or share it in chat.
3. Start the bot from the repository root:

   ```sh
   node lib/telegram-bot.mjs
   ```

4. Open your bot in Telegram and send `/start`.

To stop it, press `Ctrl+C` or send the process `SIGTERM`. This is a basic standalone bot: ordinary messages receive a receipt, but it is not connected to the Fractera agent, app data, or AI yet. The core already has its own agent Telegram integration; use that project's Messenger setup for the full agent experience.
