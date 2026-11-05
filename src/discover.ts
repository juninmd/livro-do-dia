import { chat } from "./ai.ts";
import { fetchOpenLibrary, openLibrarySearch, workKeyOf } from "./books.ts";
import type { CatalogBook } from "./config/catalog.ts";
import {
  allBooks,
  type BookRow,
  booksWithoutWorkKey,
  deleteBook,
  hasBook,
  knownWorkKeys,
  setWorkKey,
  slugify,
  syncCatalog,
} from "./db.ts";

/** Assuntos pesquisados nas APIs públicas de livros. */
const SUBJECTS: { query: string; subject: string; category: string }[] = [
  { query: 'subject:"Self-Help"', subject: "Self-help", category: "Autoconhecimento" },
  {
    query: 'subject:"Personal Finance"',
    subject: "Personal finance",
    category: "Dinheiro & Mentalidade",
  },
  {
    query: 'subject:"Business & Economics"',
    subject: "Success in business",
    category: "Negócios & Startups",
  },
  {
    query: 'subject:"Psychology"',
    subject: "Psychology",
    category: "Decisão & Comportamento",
  },
  {
    query: "desenvolvimento pessoal disciplina",
    subject: "Self-actualization (Psychology)",
    category: "Mentalidade & Disciplina",
  },
  {
    query: "produtividade hábitos foco",
    subject: "Time management",
    category: "Hábitos & Produtividade",
  },
];

const SYSTEM = `Você é um curador de livros de desenvolvimento pessoal, mentalidade, disciplina, dinheiro e alta performance.
Indique livros REAIS publicados em português do Brasil, no espírito de "Nada Pode Me Ferir" e "Os Segredos da Mente Milionária".
Nunca invente títulos ou autores.
Responda SOMENTE com a lista, um livro por linha, no formato exato:
Título | Autor | Categoria
Sem numeração, sem cabeçalho, sem comentários.`;

/**
 * Lista em linhas em vez de JSON: o modelo pequeno do cluster erra o JSON com
 * frequência (chave repetida, aspas simples) e acerta este formato.
 */
function parseLines(raw: string, fallbackCategory: string): CatalogBook[] {
  const out: CatalogBook[] = [];
  for (const line of raw.split("\n")) {
    const parts = line
      .replace(/^\s*[-*\d.)]+\s*/, "")
      .split("|")
      .map((s) => s.trim());
    if (parts.length < 2) continue;
    const [title, author, category] = parts;
    if (!title || !author || title.length > 120) continue;
    if (/^t[íi]tulo$/i.test(title)) continue; // cabeçalho ecoado pelo modelo
    out.push({ title, author, category: category || fallbackCategory });
  }
  return out;
}

/**
 * Amplia o catálogo com livros novos: sugestões da IA (LiteLLM) + busca na
 * Google Books API. Toda sugestão é validada contra a API antes de entrar —
 * IA sozinha alucina títulos.
 */
export async function discover(limit = 5): Promise<CatalogBook[]> {
  await resolveWorkKeys();
  const workKeys = knownWorkKeys();
  const known = allBooks();
  const found: CatalogBook[] = [];
  const seen = new Set(known.map((b) => norm(b.title)));
  const pool: { title: string; author: string }[] = known.map((b) => ({
    title: b.title,
    author: b.author,
  }));

  const accepted: { book: CatalogBook; workKey: string }[] = [];

  const add = (b: CatalogBook, workKey: string): boolean => {
    const key = norm(b.title);
    if (seen.has(key) || hasBook(b.title, b.author)) return false;
    if (OUT_OF_SCOPE.test(b.category)) return false;
    if (pool.some((k) => duplicate(k, b))) return false;
    // mesma obra em outro idioma ("Atomic Habits" x "Hábitos Atômicos")
    if (workKey && workKeys.has(workKey)) return false;
    seen.add(key);
    if (workKey) workKeys.add(workKey);
    pool.push(b);
    accepted.push({ book: b, workKey });
    found.push(b);
    return found.length >= limit;
  };

  for (const candidate of await suggestWithAi(known.map((b) => b.title))) {
    const real = await verify(candidate);
    if (real && add(candidate, real.workKey)) break;
  }

  if (found.length < limit) {
    for (const subject of SUBJECTS) {
      const web = await searchSubject(subject.query, subject.category);
      const raw = web.length
        ? web
        : await searchSubjectOpenLibrary(subject.subject, subject.category);
      const list = await curate(raw.filter((b) => !seen.has(norm(b.title))));
      for (const b of list) {
        const meta = await fetchOpenLibrary(b.title, b.author);
        if (add(b, workKeyOf(meta))) break;
      }
      if (found.length >= limit) break;
    }
  }

  if (found.length) {
    syncCatalog(found);
    for (const { book, workKey } of accepted) {
      if (workKey) setWorkKey(slugify(book.title, book.author), workKey);
    }
    console.log(`[discover] ${found.length} livro(s) novo(s):`);
    for (const b of found) console.log(`  + ${b.title} — ${b.author} (${b.category})`);
  } else {
    console.log("[discover] nenhum livro novo encontrado");
  }
  return found;
}

async function suggestWithAi(knownTitles: string[]): Promise<CatalogBook[]> {
  // lista completa estoura o tempo de resposta do modelo pequeno do cluster
  const sample = knownTitles.slice(-40);
  const user = `Já tenho estes livros no catálogo:\n${sample.join("; ")}\n\nSugira 8 livros DIFERENTES desses, no mesmo nicho, com edição em português do Brasil.`;
  try {
    return parseLines(await chat(SYSTEM, user), "Mentalidade & Disciplina");
  } catch (err) {
    console.error(`[discover] IA indisponível (${err}) — só busca na web`);
    return [];
  }
}

/**
 * Confirma que o título sugerido pela IA existe de verdade — modelos pequenos
 * inventam livros. Google Books primeiro; Open Library quando ela limita (429).
 * Devolve também a identidade da obra, usada para deduplicar traduções.
 */
async function verify(book: CatalogBook): Promise<{ workKey: string } | null> {
  const meta = await fetchOpenLibrary(book.title, book.author);
  if (meta) return { workKey: workKeyOf(meta) };

  const items = await googleBooks(
    `intitle:"${book.title.replace(/"/g, "")}" inauthor:"${book.author.replace(/"/g, "")}"`,
    5,
  );
  const hit = items.some(
    (v) => v.volumeInfo?.title && similar(v.volumeInfo.title, book.title),
  );
  return hit ? { workKey: "" } : null;
}

/**
 * Remove do catálogo livros que são a mesma obra (traduções/edições em outro
 * idioma), mantendo o que já foi postado.
 */
export async function pruneDuplicates(): Promise<number> {
  await resolveWorkKeys(200);
  const byKey = new Map<string, BookRow>();
  let removed = 0;

  for (const book of allBooks()) {
    if (!book.work_key) continue;
    const prev = byKey.get(book.work_key);
    if (!prev) {
      byKey.set(book.work_key, book);
      continue;
    }
    const [keep, drop] = better(prev, book) ? [prev, book] : [book, prev];
    byKey.set(book.work_key, keep);
    deleteBook(drop.slug);
    removed++;
    console.log(`[discover] duplicata removida: ${drop.title} (= ${keep.title})`);
  }

  console.log(`[discover] ${removed} duplicata(s) removida(s)`);
  return removed;
}

/** Entre duas edições da mesma obra: fica a já postada e, no empate, a em português. */
function better(a: BookRow, b: BookRow): boolean {
  if (a.rounds !== b.rounds) return a.rounds > b.rounds;
  return ptScore(a.title) >= ptScore(b.title);
}

const ptScore = (title: string) =>
  (/[áàâãéêíóôõúüç]/i.test(title) ? 2 : 0) +
  (/\b(de|da|do|das|dos|o|a|os|as|em|para|que|seu|sua|com|mais)\b/i.test(title) ? 1 : 0);

/**
 * Preenche a identidade de obra dos livros que ainda não têm — sem ela, uma
 * tradução do mesmo livro entra como se fosse novo. Poucos por rodada para
 * não martelar a API.
 */
async function resolveWorkKeys(batch = 12): Promise<void> {
  for (const book of booksWithoutWorkKey(batch)) {
    const key = workKeyOf(await fetchOpenLibrary(book.title, book.author));
    if (key) setWorkKey(book.slug, key);
  }
}

const CURATE_SYSTEM = `Você filtra resultados brutos de busca de livros para um canal de indicações de desenvolvimento pessoal, mentalidade, disciplina, dinheiro, produtividade, negócios e estoicismo.
Regras:
- DESCARTE ficção, romance, infantil, religioso devocional, biografia sem lição prática e qualquer coisa fora do nicho.
- Para os aprovados, devolva o título da edição BRASILEIRA (traduzido) quando existir.
- Nunca invente livros: use apenas os da lista recebida.
Responda SOMENTE com os APROVADOS, um por linha, no formato exato:
Título | Autor | Categoria
Se nenhum passar, responda apenas: nenhum`;

/**
 * A busca por assunto devolve muito ruído (ficção, edições em inglês de livros
 * que já temos em português). A IA filtra o nicho e normaliza o título pt-BR,
 * o que também faz a deduplicação entre idiomas funcionar.
 */
async function curate(candidates: CatalogBook[]): Promise<CatalogBook[]> {
  if (!candidates.length) return [];
  const list = candidates.map((b, i) => `${i + 1}. ${b.title} — ${b.author}`).join("\n");
  try {
    const raw = await chat(
      CURATE_SYSTEM,
      `Resultados da busca:\n${list}\n\nFiltre e normalize.`,
    );
    return (
      parseLines(raw, candidates[0]?.category ?? "Autoconhecimento")
        // a IA às vezes devolve autor que não estava na lista — mantém só os reais
        .filter((b) =>
          candidates.some((c) => similar(lastName(c.author), lastName(b.author))),
        )
    );
  } catch (err) {
    console.error(`[discover] curadoria indisponível (${err}) — descartando lote da web`);
    return [];
  }
}

const lastName = (s: string) => norm(s).split(" ").filter(Boolean).pop() ?? "";

/** A IA marca o que reprovou em vez de omitir — barra pelo rótulo também. */
const OUT_OF_SCOPE = /fic[çc]|romance|infantil|descart|reprovad|fora do nicho/i;

/** Assuntos (Open Library) aceitos e vetados para entrar no catálogo. */
const NICHE =
  /self-?help|self-?improvement|success|personal finance|money|wealth|invest|habit|discipline|motivation|productivity|time management|leadership|entrepreneur|business|psychology|stoic|mindset|conduct of life/i;
const FICTION =
  /fiction|novel|juvenile|children|romance|fantasy|science fiction|poetry|comics|drama|short stories/i;

const STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "por",
  "que",
  "the",
  "of",
  "and",
  "to",
  "in",
  "how",
]);

const tokens = (s: string) =>
  new Set(
    norm(s)
      .split(" ")
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );

/**
 * Mesmo livro em outra tradução/idioma: mesmo autor + títulos que compartilham
 * boa parte das palavras ("O Homem Mais Rico da Babilônia" vs "de Babilônia").
 */
function duplicate(a: { title: string; author: string }, b: CatalogBook): boolean {
  const [ta, tb] = [tokens(a.title), tokens(b.title)];
  if (!ta.size || !tb.size) return false;
  const shared = [...ta].filter((w) => tb.has(w)).length;
  const overlap = shared / Math.min(ta.size, tb.size);
  const sameAuthor = similar(lastName(a.author), lastName(b.author));
  return sameAuthor ? overlap >= 0.4 : overlap >= 0.8;
}

/** Busca por assunto na Open Library (fallback quando a Google Books limita). */
async function searchSubjectOpenLibrary(
  subject: string,
  category: string,
): Promise<CatalogBook[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", `subject:"${subject}"`);
  url.searchParams.set("limit", "30");
  url.searchParams.set("sort", "rating");
  url.searchParams.set(
    "fields",
    "title,author_name,cover_i,number_of_pages_median,subject",
  );

  interface Doc {
    title?: string;
    author_name?: string[];
    cover_i?: number;
    number_of_pages_median?: number;
    subject?: string[];
  }
  try {
    const docs = (await openLibrarySearch<Doc>(url)) ?? [];
    return (
      docs
        .filter((d) => d.title && d.author_name?.length && d.cover_i)
        .filter((d) => (d.number_of_pages_median ?? 0) >= 100)
        // o assunto pedido volta misturado com ficção — exige tema do nicho e
        // rejeita explicitamente narrativa
        .filter((d) => {
          const subjects = (d.subject ?? []).join(" ; ");
          return NICHE.test(subjects) && !FICTION.test(subjects);
        })
        .map((d) => ({
          // biome-ignore lint/style/noNonNullAssertion: filtrado acima
          title: d.title!.trim(),
          // biome-ignore lint/style/noNonNullAssertion: filtrado acima
          author: d.author_name![0]!.trim(),
          category,
        }))
    );
  } catch (err) {
    console.error(`[discover] openlibrary falhou em "${subject}": ${err}`);
    return [];
  }
}

async function searchSubject(query: string, category: string): Promise<CatalogBook[]> {
  const items = await googleBooks(query, 20, "newest");
  const out: CatalogBook[] = [];
  for (const v of items) {
    const info = v.volumeInfo;
    if (!info?.title || !info.authors?.length) continue;
    if (info.language !== "pt") continue;
    if ((info.description?.length ?? 0) < 200) continue;
    if ((info.pageCount ?? 0) < 100) continue;
    if (!info.imageLinks?.thumbnail) continue;
    out.push({ title: info.title.trim(), author: info.authors[0]!.trim(), category });
  }
  return out;
}

interface Volume {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    pageCount?: number;
    language?: string;
    imageLinks?: Record<string, string>;
  };
}

async function googleBooks(
  q: string,
  maxResults: number,
  orderBy?: string,
): Promise<Volume[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", q);
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("printType", "books");
  url.searchParams.set("langRestrict", "pt");
  url.searchParams.set("country", "BR");
  if (orderBy) url.searchParams.set("orderBy", orderBy);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[discover] google books ${res.status} em "${q}"`);
      return [];
    }
    return ((await res.json()) as { items?: Volume[] }).items ?? [];
  } catch (err) {
    console.error(`[discover] falha em "${q}": ${err}`);
    return [];
  }
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const similar = (a: string, b: string) => {
  const [x, y] = [norm(a), norm(b)];
  return x === y || x.includes(y) || y.includes(x);
};
