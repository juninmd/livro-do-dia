/** Metadados públicos do livro (Google Books) — capa, sinopse editorial, ficha. */
export interface BookMeta {
  title: string;
  authors: string;
  description: string;
  publisher: string;
  publishedYear: string;
  pageCount: number | null;
  cover: string;
  isbn: string;
  infoLink: string;
}

interface Volume {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    publisher?: string;
    publishedDate?: string;
    pageCount?: number;
    language?: string;
    infoLink?: string;
    imageLinks?: Record<string, string>;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

const API = "https://www.googleapis.com/books/v1/volumes";

/**
 * Busca o volume que melhor casa com título+autor, preferindo edição pt-BR
 * com capa. Retorna null se a API falhar ou nada casar — o post cai no
 * fallback só-texto.
 */
export async function fetchBookMeta(
  title: string,
  author: string,
): Promise<BookMeta | null> {
  const queries = [
    `intitle:${quote(title)}+inauthor:${quote(author)}`,
    `intitle:${quote(title)}`,
    `${title} ${author}`,
  ];

  for (const q of queries) {
    const volumes = await search(q);
    const best = pick(volumes, title);
    if (best) return best;
  }
  return null;
}

const quote = (s: string) => `"${s.replace(/"/g, "")}"`;

async function search(q: string): Promise<Volume[]> {
  const url = `${API}?q=${encodeURIComponent(q)}&maxResults=10&printType=books&country=BR`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[books] ${res.status} em "${q}"`);
      return [];
    }
    const json = (await res.json()) as { items?: Volume[] };
    return json.items ?? [];
  } catch (err) {
    console.error(`[books] falha em "${q}": ${err}`);
    return [];
  }
}

/** Pontua por idioma pt, presença de capa/descrição e semelhança do título. */
function pick(volumes: Volume[], wanted: string): BookMeta | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const target = norm(wanted);

  let bestScore = -1;
  let best: BookMeta | null = null;

  for (const v of volumes) {
    const info = v.volumeInfo;
    if (!info?.title) continue;
    const full = norm(`${info.title} ${info.subtitle ?? ""}`);
    let score = 0;
    if (full === target) score += 5;
    else if (full.includes(target) || target.includes(full)) score += 3;
    if (info.language === "pt") score += 3;
    if (info.imageLinks?.thumbnail) score += 2;
    if ((info.description?.length ?? 0) > 120) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = toMeta(info);
    }
  }
  // exige alguma aderência ao título pedido — evita indicar outro livro
  return bestScore >= 3 ? best : null;
}

function toMeta(info: NonNullable<Volume["volumeInfo"]>): BookMeta {
  const isbn =
    info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
    info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
    "";
  const raw =
    info.imageLinks?.extraLarge ??
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail ??
    "";
  return {
    title: [info.title, info.subtitle].filter(Boolean).join(": "),
    authors: (info.authors ?? []).join(", "),
    description: stripHtml(info.description ?? ""),
    publisher: info.publisher ?? "",
    publishedYear: (info.publishedDate ?? "").slice(0, 4),
    pageCount: info.pageCount ?? null,
    cover: upgradeCover(raw),
    isbn,
    infoLink: info.infoLink ?? "",
  };
}

/** Capa em resolução maior e https — o Telegram rejeita http e miniaturas ruins. */
function upgradeCover(url: string): string {
  if (!url) return "";
  return url
    .replace(/^http:/, "https:")
    .replace(/&edge=curl/, "")
    .replace(/([?&])zoom=\d/, "$1zoom=2");
}

/**
 * Fallback quando a Google Books está indisponível/limitada (429 é comum sem
 * API key). A Open Library é aberta e tem capa da maioria das edições — o
 * título original em inglês costuma casar melhor que o título traduzido.
 */
export async function fetchOpenLibrary(
  title: string,
  author: string,
): Promise<BookMeta | null> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", `${title} ${author}`);
  url.searchParams.set("limit", "10");
  url.searchParams.set(
    "fields",
    "title,author_name,cover_i,first_publish_year,number_of_pages_median,publisher,isbn,key",
  );

  interface Doc {
    title?: string;
    author_name?: string[];
    cover_i?: number;
    first_publish_year?: number;
    number_of_pages_median?: number;
    publisher?: string[];
    isbn?: string[];
    key?: string;
  }

  const docs = await openLibrarySearch<Doc>(url);
  if (!docs) return null;

  const surname = lastWord(author);
  const hit = docs.find(
    (d) => d.cover_i && (d.author_name ?? []).some((a) => normalize(a).includes(surname)),
  );
  if (!hit) {
    console.error(
      `[books] openlibrary sem capa para "${title}" (${docs.length} resultados)`,
    );
    return null;
  }

  return {
    title: hit.title ?? title,
    authors: hit.author_name?.join(", ") ?? author,
    description: "",
    publisher: hit.publisher?.[0] ?? "",
    publishedYear: hit.first_publish_year ? String(hit.first_publish_year) : "",
    pageCount: hit.number_of_pages_median ?? null,
    cover: `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`,
    isbn: hit.isbn?.[0] ?? "",
    infoLink: hit.key ? `https://openlibrary.org${hit.key}` : "",
  };
}

/**
 * A Open Library estrangula clientes anônimos (devolve 0 resultados) — exige
 * User-Agent identificável. Uma repetição cobre o estrangulamento residual.
 */
export const OPEN_LIBRARY_UA = "livro-do-dia/1.0 (github.com/juninmd/livro-do-dia)";

export async function openLibrarySearch<T>(url: URL): Promise<T[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch(url, {
        headers: { "user-agent": OPEN_LIBRARY_UA },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        console.error(`[books] openlibrary ${res.status}`);
        continue;
      }
      const docs = ((await res.json()) as { docs?: T[] }).docs ?? [];
      if (docs.length) return docs;
    } catch (err) {
      console.error(`[books] openlibrary falhou: ${err}`);
    }
  }
  return null;
}

/** Extrai a identidade da obra (/works/OL…W) do link da Open Library. */
export const workKeyOf = (meta: BookMeta | null): string =>
  meta?.infoLink.match(/\/works\/OL\d+W/)?.[0] ?? "";

/** Confirma que a URL da capa responde uma imagem — o Telegram rejeita links quebrados. */
export async function coverWorks(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": OPEN_LIBRARY_UA },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return false;
    const type = res.headers.get("content-type") ?? "";
    const size = (await res.arrayBuffer()).byteLength;
    // a Open Library devolve um GIF de 1px quando não tem a capa
    return type.startsWith("image/") && size > 3000;
  } catch {
    return false;
  }
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim();

const lastWord = (s: string) => normalize(s).split(" ").filter(Boolean).pop() ?? "";

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
