import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type CatalogBook, catalog } from "./config/catalog.ts";
import { env } from "./config/env.ts";

mkdirSync(dirname(env.dbPath), { recursive: true });

export const db = new Database(env.dbPath, { create: true });
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    slug      TEXT PRIMARY KEY,
    title     TEXT NOT NULL,
    author    TEXT NOT NULL,
    category  TEXT NOT NULL,
    posted_at TEXT,
    rounds    INTEGER NOT NULL DEFAULT 0,
    work_key  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_books_rotation ON books(rounds, posted_at);
`);

// bancos criados antes da deduplicação por obra não têm a coluna
const columns = db.query<{ name: string }, []>("PRAGMA table_info(books)").all();
if (!columns.some((c) => c.name === "work_key")) {
  db.exec("ALTER TABLE books ADD COLUMN work_key TEXT");
}
db.exec("CREATE INDEX IF NOT EXISTS idx_books_work_key ON books(work_key)");

export interface BookRow {
  slug: string;
  title: string;
  author: string;
  category: string;
  posted_at: string | null;
  rounds: number;
  /** Identidade da obra na Open Library (/works/OL…W) — igual em qualquer idioma. */
  work_key: string | null;
}

export const slugify = (title: string, author: string): string =>
  `${title}-${author}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** Insere livros novos do catálogo e atualiza metadados dos já conhecidos. */
export function syncCatalog(books: CatalogBook[] = catalog): void {
  const stmt = db.prepare<unknown, [string, string, string, string]>(`
    INSERT INTO books (slug, title, author, category) VALUES (?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET title = excluded.title,
                                    author = excluded.author,
                                    category = excluded.category
  `);
  const tx = db.transaction((list: CatalogBook[]) => {
    for (const b of list)
      stmt.run(slugify(b.title, b.author), b.title, b.author, b.category);
  });
  tx(books);
}

/**
 * Próximo livro da rotação: menor número de rodadas já postadas, depois o
 * que ficou mais tempo sem aparecer. Nunca repete enquanto houver inédito.
 */
export function nextBook(): BookRow | null {
  return (
    db
      .query<BookRow, []>(
        "SELECT * FROM books ORDER BY rounds ASC, posted_at ASC NULLS FIRST, slug ASC LIMIT 1",
      )
      .get() ?? null
  );
}

export function allBooks(): BookRow[] {
  return db.query<BookRow, []>("SELECT * FROM books ORDER BY title").all();
}

export function hasBook(title: string, author: string): boolean {
  return Boolean(findBook(slugify(title, author)));
}

export function findBook(slug: string): BookRow | null {
  return (
    db.query<BookRow, [string]>("SELECT * FROM books WHERE slug = ?").get(slug) ?? null
  );
}

/** Livros ainda sem identidade de obra resolvida (usada para deduplicar traduções). */
export function booksWithoutWorkKey(limit: number): BookRow[] {
  return db
    .query<BookRow, [number]>(
      "SELECT * FROM books WHERE work_key IS NULL ORDER BY rounds DESC, title LIMIT ?",
    )
    .all(limit);
}

export function knownWorkKeys(): Set<string> {
  const rows = db
    .query<{ work_key: string }, []>(
      "SELECT work_key FROM books WHERE work_key IS NOT NULL",
    )
    .all();
  return new Set(rows.map((r) => r.work_key));
}

export function setWorkKey(slug: string, workKey: string): void {
  db.prepare<unknown, [string, string]>(
    "UPDATE books SET work_key = ? WHERE slug = ?",
  ).run(workKey, slug);
}

export function deleteBook(slug: string): void {
  db.prepare<unknown, [string]>("DELETE FROM books WHERE slug = ?").run(slug);
}

export function markPosted(slug: string): void {
  db.prepare<unknown, [string, string]>(
    "UPDATE books SET posted_at = ?, rounds = rounds + 1 WHERE slug = ?",
  ).run(new Date().toISOString(), slug);
}
