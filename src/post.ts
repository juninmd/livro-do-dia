import { chat, parseJsonObject } from "./ai.ts";
import { amazonLink } from "./amazon.ts";
import {
  type BookMeta,
  coverWorks,
  fetchBookMeta,
  fetchOpenLibrary,
  workKeyOf,
} from "./books.ts";
import { type BookRow, markPosted, nextBook, setWorkKey } from "./db.ts";
import { sendTelegram, sendTelegramPhoto } from "./telegram.ts";

const SYSTEM = `Você é um curador de livros brasileiro que escreve indicações diárias no Telegram.
Estilo: direto, motivador, sem enrolação, português do Brasil.
As curiosidades devem ser SOBRE O TEXTO DO LIVRO: conceitos e termos que ele cunhou,
estrutura dos capítulos, metáforas e histórias que ele usa, a tese que defende.
PROIBIDO citar: número de vendas, prêmios, rankings, empresas fundadas, cargos,
universidades, datas ou qualquer fato biográfico do autor. Se a curiosidade não puder
ser respondida por quem leu o livro, não escreva — prefira menos itens.
Responda SOMENTE com um objeto JSON válido, sem cercas de código, no formato:
{
  "tituloOriginal": "título original do livro no idioma em que foi escrito (se for brasileiro, repita o título)",
  "tagline": "uma frase de impacto sobre o livro (máx 120 caracteres)",
  "sinopse": "2 a 3 frases sobre do que trata o livro",
  "resumo": ["4 a 6 aprendizados centrais, uma frase cada"],
  "curiosidades": ["2 a 4 curiosidades sobre o conteúdo do livro"],
  "frase": "uma citação ou ideia-chave do livro",
  "paraQuem": "para quem esse livro é indicado, uma frase"
}`;

interface Enrichment {
  tituloOriginal: string;
  tagline: string;
  sinopse: string;
  resumo: string[];
  curiosidades: string[];
  frase: string;
  paraQuem: string;
}

/** Gera resumo/sinopse/curiosidades via IA; sem IA, cai na sinopse do Google Books. */
async function enrich(book: BookRow, meta: BookMeta | null): Promise<Enrichment> {
  const ficha = [
    `Título: ${book.title}`,
    `Autor: ${book.author}`,
    `Categoria: ${book.category}`,
    meta?.publishedYear && `Ano: ${meta.publishedYear}`,
    meta?.pageCount && `Páginas: ${meta.pageCount}`,
    meta?.description && `Descrição da editora: ${meta.description.slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await chat(SYSTEM, `Livro:\n${ficha}\n\nGere a indicação do dia.`);
    const data = parseJsonObject<Partial<Enrichment>>(raw);
    return {
      tituloOriginal: data.tituloOriginal?.trim() || "",
      tagline: data.tagline?.trim() || "",
      sinopse: data.sinopse?.trim() || meta?.description?.slice(0, 400) || "",
      resumo: arr(data.resumo),
      curiosidades: arr(data.curiosidades),
      frase: data.frase?.trim() || "",
      paraQuem: data.paraQuem?.trim() || "",
    };
  } catch (err) {
    console.error(`[post] IA falhou (${err}) — usando dados da editora`);
    return {
      tituloOriginal: "",
      tagline: "",
      sinopse: meta?.description?.slice(0, 600) || "",
      resumo: [],
      curiosidades: [],
      frase: "",
      paraQuem: "",
    };
  }
}

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : [];

export interface BuiltPost {
  cover: string;
  /** Cabeçalho + gancho: cabe na legenda da foto (1024 chars). */
  caption: string;
  /** Post completo, usado quando não há capa. */
  full: string;
  /** Continuação enviada como mensagem quando o post não cabe na legenda. */
  rest: string;
}

export async function buildPost(book: BookRow): Promise<BuiltPost> {
  let meta =
    (await fetchBookMeta(book.title, book.author)) ??
    (await fetchOpenLibrary(book.title, book.author));
  const data = await enrich(book, meta);

  // sem capa? tenta de novo pelo título original — a Open Library indexa
  // muito melhor a edição em inglês que a tradução.
  if (!meta?.cover && data.tituloOriginal && data.tituloOriginal !== book.title) {
    const alt = await fetchOpenLibrary(data.tituloOriginal, book.author);
    if (alt) meta = { ...alt, description: meta?.description || alt.description };
  }

  const cover = (await coverWorks(meta?.cover ?? "")) ? (meta?.cover ?? "") : "";
  if (meta?.cover && !cover) console.error(`[post] capa inválida: ${meta.cover}`);

  // aproveita a consulta para registrar a identidade da obra (dedupe de traduções)
  const workKey = workKeyOf(meta);
  if (workKey && !book.work_key) setWorkKey(book.slug, workKey);

  const link = amazonLink(book.title, book.author);
  const linkPdf = amazonLink(book.title, book.author, "PDF");

  const date = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const ficha = [
    book.category,
    meta?.publishedYear,
    meta?.pageCount ? `${meta.pageCount} págs` : "",
    meta?.publisher,
  ]
    .filter(Boolean)
    .join(" • ");

  const header = [
    `📚 *Livro do Dia* — ${date}`,
    "",
    `*${esc(book.title)}*`,
    `✍️ ${esc(meta?.authors || book.author)}`,
    ficha ? `_${esc(ficha)}_` : "",
    data.tagline ? `\n💥 ${esc(data.tagline)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [
    data.sinopse && `📖 *Sinopse*\n${esc(data.sinopse)}`,
    data.resumo.length &&
      `🧠 *O que você leva do livro*\n${data.resumo.map((r) => `• ${esc(r)}`).join("\n")}`,
    data.curiosidades.length &&
      `💡 *Curiosidades*\n${data.curiosidades.map((c) => `• ${esc(c)}`).join("\n")}`,
    data.frase && `❝ _${esc(data.frase)}_ ❞`,
    data.paraQuem && `🎯 *Para quem é:* ${esc(data.paraQuem)}`,
    `🛒 [Comprar na Amazon](${link})\n📄 [Buscar versão PDF](${linkPdf})`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const full = `${header}\n\n${sections}`;
  return {
    cover,
    caption: full.length <= 1024 ? full : header,
    full,
    rest: full.length <= 1024 ? "" : sections,
  };
}

/** Escolhe o livro do dia, monta e publica no Telegram. */
export async function postDaily(dryRun = false): Promise<void> {
  const book = nextBook();
  if (!book) {
    console.error("[post] catálogo vazio — rode a sincronização primeiro");
    return;
  }
  console.log(`[post] livro do dia: ${book.title} — ${book.author}`);

  const post = await buildPost(book);

  if (dryRun) {
    console.log(`\ncapa: ${post.cover || "(sem capa)"}\n\n${post.full}\n`);
    return;
  }

  if (post.cover) {
    await sendTelegramPhoto(post.cover, post.caption);
    if (post.rest) await sendTelegram(post.rest);
  } else {
    await sendTelegram(post.full);
  }

  markPosted(book.slug);
  console.log(`[post] publicado: ${book.title}`);
}

/** Markdown legado do Telegram: só precisa neutralizar os marcadores. */
const esc = (s: string) => s.replace(/([*_`[\]])/g, "");
