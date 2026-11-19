import { env } from "./config/env.ts";

const api = (method: string) =>
  `https://api.telegram.org/bot${env.telegramToken}/${method}`;

const configured = () => Boolean(env.telegramToken && env.telegramChatIds.length);

/** Envia texto (Markdown) para todos os chats. Cai para texto puro se o Markdown for rejeitado. */
export async function sendTelegram(text: string): Promise<void> {
  if (!configured())
    return console.log(`[telegram] não configurado — post:\n\n${text}\n`);
  for (const chatId of env.telegramChatIds) {
    for (const chunk of split(text, 3800)) {
      const ok = await call("sendMessage", {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      });
      if (!ok) {
        await call("sendMessage", {
          chat_id: chatId,
          text: stripMarkdown(chunk),
          disable_web_page_preview: false,
        });
      }
    }
  }
}

/**
 * Envia a capa com legenda. Se a foto falhar (URL bloqueada/quebrada) ou o
 * Markdown for inválido, degrada para texto — nunca deixa o post no chão.
 */
export async function sendTelegramPhoto(photo: string, caption: string): Promise<void> {
  if (!configured()) {
    console.log(`[telegram] não configurado — capa: ${photo}\n\n${caption}\n`);
    return;
  }
  const cap = caption.slice(0, 1024);
  for (const chatId of env.telegramChatIds) {
    const base = { chat_id: chatId, photo };
    let ok = await call("sendPhoto", { ...base, caption: cap, parse_mode: "Markdown" });
    if (!ok) ok = await call("sendPhoto", { ...base, caption: stripMarkdown(cap) });
    if (!ok) {
      console.error("[telegram] sendPhoto falhou — enviando só texto");
      await sendTelegram(caption);
    }
  }
}

async function call(method: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(api(method), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(
        `[telegram] ${method} ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[telegram] ${method} falhou: ${err}`);
    return false;
  }
}

const stripMarkdown = (s: string) => s.replace(/[*_`[\]]/g, "");

/** Quebra por linha em pedaços de até `max`; uma linha maior que `max` é cortada ao meio, nunca vira pedaço vazio ou grande demais. */
export function split(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let buf = "";
  for (const raw of text.split("\n")) {
    for (let i = 0; i === 0 || i < raw.length; i += max - 1) {
      const line = raw.slice(i, i + max - 1);
      if (buf && buf.length + line.length + 1 > max) {
        out.push(buf);
        buf = "";
      }
      buf += `${line}\n`;
    }
  }
  if (buf) out.push(buf);
  return out;
}
