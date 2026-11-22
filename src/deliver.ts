import { sendTelegram, sendTelegramPhoto } from "./telegram.ts";

export interface Deliverable {
  cover: string;
  caption: string;
  full: string;
  rest: string;
}

/** Limite de legenda de foto no Telegram. */
export const CAPTION_MAX = 1024;

/**
 * Divide o post entre legenda e continuação. Se nem o cabeçalho com o gancho
 * cabe na legenda, o gancho desce para a continuação em vez de ser cortado.
 */
export function layoutPost(head: string, tagline: string, sections: string) {
  const header = tagline ? `${head}\n${tagline}` : head;
  const full = `${header}\n\n${sections}`;
  if (full.length <= CAPTION_MAX) return { caption: full, full, rest: "" };
  if (header.length <= CAPTION_MAX) return { caption: header, full, rest: sections };
  const rest = tagline ? `${tagline.trim()}\n\n${sections}` : sections;
  return { caption: head.slice(0, CAPTION_MAX), full, rest };
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
