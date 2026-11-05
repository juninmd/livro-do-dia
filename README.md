# 📚 livro-do-dia

Bot que indica **um livro por dia** no Telegram — capa, sinopse, resumo em tópicos,
curiosidades e link de compra na Amazon. Nicho: mentalidade, disciplina, dinheiro,
hábitos, estoicismo e negócios (estilo *Nada Pode Me Ferir* / *Os Segredos da Mente Milionária*).

## Como funciona

```
catálogo (SQLite)  ──►  descoberta (IA LiteLLM + Google Books/Open Library)
        │                          │
        │                          └─► livros novos validados entram no catálogo
        ▼
rodízio do dia ──► capa + ficha (Google Books → Open Library) ──► IA escreve o post ──► Telegram
```

- **Rodízio**: sempre o livro com menos rodadas postadas; só repete quando o catálogo inteiro girou.
- **Descoberta**: a IA sugere títulos e a busca por assunto varre a web; **nada entra sem
  ser confirmado** numa API de livros (modelo pequeno inventa título).
- **Deduplicação**: pela *work key* da Open Library — a mesma obra em outro idioma
  (`Atomic Habits` = `Hábitos Atômicos`) não entra duas vezes.
- **Fallbacks**: sem capa → post só texto; IA fora → usa a sinopse da editora;
  Markdown recusado pelo Telegram → texto puro.

## Comandos

```bash
bun install
cp .env.example .env      # preencher token e chat

bun run preview           # monta o post do dia e imprime no console (não envia)
bun run post              # descobre livros novos + publica no Telegram
bun start                 # loop com cron diário (CRON_POST, fuso America/Sao_Paulo)

bun run src/index.ts --discover   # só a descoberta de livros novos
bun run src/index.ts --prune      # remove traduções duplicadas do catálogo
bun run typecheck && bun run lint
```

## Configuração (.env)

| Variável | Para quê |
| --- | --- |
| `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL` | LiteLLM do cluster (API compatível com OpenAI) |
| `TELEGRAM_BOT_TOKEN` | mesmo bot do `evo-agent` |
| `TELEGRAM_CHAT_IDS` | um ou mais chats/canais separados por vírgula |
| `AMAZON_ASSOCIATE_TAG` | tag de afiliado (opcional; sem ela o link vai sem comissão) |
| `CRON_POST` | agenda do post (padrão `0 8 * * *`) |
| `AI_PROVIDER` | `openai` (padrão), `anthropic`, `google` ou `ollama` |

O cluster usa certificado self-signed: em dev, `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Fontes

- **Google Books API** — capa, sinopse da editora e ficha. Sem API key ela devolve
  `429` com frequência; por isso existe o fallback abaixo.
- **Open Library** — capa, ficha e identidade da obra (`/works/OL…W`). Aberta, sem key.
- **Amazon.com.br** — link de busca por título + autor (ASIN/ISBN muda por edição).
