import { env } from "./config/env.ts";

const api = (method: string) =>
  `https://api.telegram.org/bot${env.telegramToken}/${method}`;

const configured = () => Boolean(env.telegramToken && env.telegramChatIds.length);

/** Envia texto (Markdown) a um chat; cai para texto puro se o Markdown for rejeitado. */
async function sendText(chatId: string, text: string): Promise<boolean> {
  let delivered = true;
  for (const chunk of split(text, 3800)) {
    const ok =
      (await call("sendMessage", {
        chat_id: chatId,
        text: chunk,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      })) ||
      (await call("sendMessage", {
        chat_id: chatId,
        text: stripMarkdown(chunk),
        disable_web_page_preview: false,
      }));
    if (!ok) delivered = false;
  }
  return delivered;
}

/**
 * Envia texto para todos os chats. Retorna true se ao menos um chat recebeu
 * tudo (ou se o Telegram não está configurado e o post só foi logado).
 */
export async function sendTelegram(text: string): Promise<boolean> {
  if (!configured()) {
    console.log(`[telegram] não configurado — post:\n\n${text}\n`);
    return true;
  }
  let any = false;
  for (const chatId of env.telegramChatIds) {
    if (await sendText(chatId, text)) any = true;
  }
  return any;
}

/**
 * Envia a capa com legenda. Se a foto falhar (URL bloqueada/quebrada) ou o
 * Markdown for inválido, degrada para texto só naquele chat — nunca deixa o
 * post no chão nem duplica em chats que já receberam a foto.
 * Retorna true se ao menos um chat recebeu o post.
 */
export async function sendTelegramPhoto(
  photo: string,
  caption: string,
): Promise<boolean> {
  if (!configured()) {
    console.log(`[telegram] não configurado — capa: ${photo}\n\n${caption}\n`);
    return true;
  }
  const cap = caption.slice(0, 1024);
  let any = false;
  for (const chatId of env.telegramChatIds) {
    const base = { chat_id: chatId, photo };
    let ok = await call("sendPhoto", { ...base, caption: cap, parse_mode: "Markdown" });
    if (!ok) ok = await call("sendPhoto", { ...base, caption: stripMarkdown(cap) });
    if (!ok) {
      console.error("[telegram] sendPhoto falhou — enviando só texto");
      ok = await sendText(chatId, caption);
    }
    if (ok) any = true;
  }
  return any;
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
