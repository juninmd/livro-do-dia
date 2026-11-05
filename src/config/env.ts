// Bun carrega .env automaticamente — sem dotenv.
export const env = {
  aiProvider: (process.env.AI_PROVIDER ?? "openai") as
    | "openai"
    | "anthropic"
    | "google"
    | "ollama",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 120000),

  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatIds: (process.env.TELEGRAM_CHAT_IDS ?? process.env.TELEGRAM_CHAT_ID ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  amazonTag: process.env.AMAZON_ASSOCIATE_TAG ?? "",
  cronPost: process.env.CRON_POST ?? "0 8 * * *",
  dbPath: process.env.DB_PATH ?? "./data/store.db",
};
