import { sendTelegram, sendTelegramPhoto } from "./telegram.ts";

export interface Deliverable {
  cover: string;
  caption: string;
  full: string;
  rest: string;
}

export interface Senders {
  photo: (url: string, caption: string) => Promise<boolean>;
  text: (text: string) => Promise<boolean>;
}

/**
 * Publica o post: foto + legenda (e a continuação) quando há capa. Se o Telegram
 * recusar a foto, manda o post completo só em texto em vez de deixar sair só a
 * continuação, sem cabeçalho.
 */
export async function deliverPost(
  post: Deliverable,
  send: Senders = { photo: sendTelegramPhoto, text: sendTelegram },
): Promise<boolean> {
  if (!post.cover) return send.text(post.full);
  if (await send.photo(post.cover, post.caption)) {
    if (post.rest) await send.text(post.rest);
    return true;
  }
  console.error("[post] Telegram recusou a capa — enviando o post só em texto");
  return send.text(post.full);
}
