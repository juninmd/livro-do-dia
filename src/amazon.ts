import { env } from "./config/env.ts";

/**
 * Link de compra na Amazon.com.br. Busca por título + autor em vez de ASIN ou
 * ISBN: ASIN muda por edição e o ISBN que temos costuma ser o da edição em
 * inglês, que não acha o livro na loja brasileira.
 */
export function amazonLink(title: string, author: string, formato = ""): string {
  const url = new URL("https://www.amazon.com.br/s");
  url.searchParams.set("k", [title, author, formato].filter(Boolean).join(" "));
  url.searchParams.set("i", "stripbooks");
  if (env.amazonTag) url.searchParams.set("tag", env.amazonTag);
  return url.toString();
}
