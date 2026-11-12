# 📚 livro-do-dia

Um livro por dia no Telegram — capa, sinopse, resumo em tópicos, curiosidades e link de compra.

O bot mantém um catálogo em SQLite, gira os títulos para não repetir, amplia o catálogo sozinho com livros validados em APIs públicas e escreve a indicação com uma IA. O nicho é fixo: mentalidade, disciplina, hábitos, dinheiro, estoicismo e negócios — o espírito de *Nada Pode Me Ferir* e *Os Segredos da Mente Milionária*.

## O que chega no Telegram

O post é montado por `buildPost()` e tem uma estrutura fixa:

```text
📚 *Livro do Dia* — <data em pt-BR, fuso America/Sao_Paulo>

*<título>*
✍️ <autores>
_<categoria> • <ano> • <páginas> • <editora>_
💥 <tagline>

📖 *Sinopse*
<2 a 3 frases>

🧠 *O que você leva do livro*
• <aprendizado>
• ...

💡 *Curiosidades*
• <curiosidade sobre o conteúdo do livro>
• ...

❝ <frase ou ideia-chave> ❞

🎯 *Para quem é:* <uma frase>

🛒 [Comprar na Amazon](<busca por título + autor>)
📄 [Buscar versão PDF](<mesma busca, com "PDF">)
```

A capa vai como foto, com o cabeçalho na legenda. O Telegram limita legenda a 1.024 caracteres, então o post tem duas formas: se o texto inteiro couber, ele é a legenda; se não couber, a foto leva só o cabeçalho e o resto vai numa segunda mensagem. Sem capa válida, tudo vai como texto único.

O prompt da IA proíbe explicitamente curiosidades biográficas — nada de número de vendas, prêmios, empresas fundadas, cargos ou datas. A curiosidade tem que ser sobre o **texto** do livro: conceitos, estrutura, metáforas, a tese. Se não houver o que dizer, o post vem com menos itens.

## Pipeline

```text
catálogo fixo (src/config/catalog.ts, 61 títulos)
        │  syncCatalog() no boot
        ▼
   SQLite (books: slug, rounds, posted_at, work_key)
        │
        ├── descoberta ──► IA sugere títulos ──► valida em Google Books/Open Library
        │                  busca por assunto ──► IA filtra o nicho ──► valida
        │                                    (nada entra sem confirmação numa API)
        ▼
   rodízio do dia ──► metadados ──► IA escreve o post ──► Telegram
```

1. **Catálogo.** `src/config/catalog.ts` traz 61 livros com título em português, autor e categoria. No boot, `syncCatalog()` insere os que faltam e atualiza título/autor/categoria dos existentes, sem tocar em `rounds`/`posted_at`.
2. **Rodízio.** `nextBook()` escolhe o livro com menos rodadas postadas, depois o que ficou mais tempo sem aparecer (`posted_at` nulo primeiro), desempatando por `slug`. Só repete quando o catálogo inteiro girou.
3. **Metadados.** Google Books primeiro (capa, sinopse da editora, ano, páginas, editora, ISBN), Open Library como fallback.
4. **Texto.** A IA recebe título, autor, categoria, ano, páginas e a descrição da editora, e devolve JSON com tagline, sinopse, 4–6 aprendizados, 2–4 curiosidades, frase e "para quem é".
5. **Publicação.** Capa validada, legenda montada, envio para todos os chats de `TELEGRAM_CHAT_IDS`, e `markPosted()` incrementa `rounds`.

## Instalação

Pré-requisitos: [Bun](https://bun.sh) e um bot do Telegram. O banco é `bun:sqlite` — não há servidor para instalar.

```bash
bun install
cp .env.example .env
```

Preencha pelo menos `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_IDS`. Para ver o post do dia sem enviar nada:

```bash
bun run preview
```

O preview imprime a URL da capa e o texto completo no console e **não** marca o livro como postado — rodar `preview` dez vezes mostra o mesmo livro dez vezes.

Para publicar:

```bash
bun run post      # descobre livros novos e publica
bun start         # fica em loop, com cron diário no fuso America/Sao_Paulo
```

## Comandos

| Comando | O que faz |
|---|---|
| `bun run dev` | `src/index.ts` sem argumentos: descoberta + post e sai (`process.exit(0)`) |
| `bun run post` | `--post`: descoberta + post, e sai |
| `bun run preview` | `--preview`: monta e imprime o post, sem enviar e sem marcar como postado |
| `bun start` | `--loop`: agenda `CRON_POST` com `node-cron` e fica vivo |
| `bun run src/index.ts --discover` | só a descoberta de livros novos (até 5 por chamada) |
| `bun run src/index.ts --prune` | remove do catálogo traduções/edições da mesma obra |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` | `biome check --write .` — **escreve** os arquivos |

`bun run post` e `bun run dev` chamam `discover()` antes de publicar. Se a descoberta falhar (IA fora, APIs limitando), o erro é logado e o post do dia continua — as duas etapas são independentes.

## Configuração

| Variável | Padrão | Para quê |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | vazio | Token do bot |
| `TELEGRAM_CHAT_IDS` | vazio | Um ou mais chats/canais, separados por vírgula (`TELEGRAM_CHAT_ID` singular também é aceito) |
| `AI_PROVIDER` | `openai` | `openai`, `anthropic`, `google` ou `ollama` |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Base compatível com OpenAI — no cluster, aponta para o LiteLLM |
| `OPENAI_API_KEY` | vazio | Chave do endpoint acima |
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo usado quando o provider é `openai` |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Base do Ollama |
| `OLLAMA_MODEL` | `llama3.2` | Modelo do Ollama |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` | vazio / `claude-haiku-4-5-20251001` | Provider `anthropic` |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | vazio / `gemini-2.5-flash` | Provider `google` |
| `AI_TIMEOUT_MS` | `120000` | Timeout de cada chamada de IA |
| `AMAZON_ASSOCIATE_TAG` | vazio | Tag de afiliado; sem ela o link vai sem comissão |
| `CRON_POST` | `0 8 * * *` | Agenda do `--loop` (timezone fixo em `America/Sao_Paulo`) |
| `DB_PATH` | `./data/store.db` | Banco SQLite |

`NODE_TLS_REJECT_UNAUTHORIZED=0`, que aparece no `.env.example`, não é do bot: é uma variável do Node que desliga a verificação de TLS **para o processo inteiro**. Só faz sentido em desenvolvimento, contra o certificado self-signed do cluster.

O `.env` é carregado pelo próprio Bun — não há `dotenv` no projeto.

## Docker

```bash
docker build -t livro-do-dia .
docker run --rm --env-file .env -v livro-do-dia-data:/data livro-do-dia
```

A imagem é `oven/bun:1-slim`, instala com `--frozen-lockfile --production`, copia `package.json`, `bun.lock` e `src/`, e roda `bun run src/index.ts --post`. Ela é de **uma execução só**: publica e sai. O agendamento fica por conta de quem orquestra — cron do host, CronJob do Kubernetes ou o timer que você já usa.

O `DB_PATH` da imagem é `/data/store.db`; sem um volume em `/data`, o catálogo e o histórico de rodadas se perdem a cada container. O `.env` não é copiado para a imagem: passe as variáveis por `--env-file` ou pelo orquestrador.

## Descoberta de livros

`discover()` roda antes do post e tenta deixar o catálogo maior, em duas frentes:

1. **Sugestão da IA.** O modelo recebe os últimos 40 títulos do catálogo e pede 8 livros diferentes, com edição em português. A resposta vem em linhas `Título | Autor | Categoria` — o modelo pequeno do cluster erra JSON com frequência e acerta esse formato.
2. **Busca por assunto.** Se a IA não completar a cota, o bot consulta a Google Books (assuntos como self-help, personal finance, business, psychology, produtividade e disciplina) e, quando ela limita, a Open Library com `sort=rating`. Os resultados brutos passam por uma segunda chamada de IA que descarta ficção, romance, infantil e biografia sem lição prática, e normaliza o título para a edição brasileira.

**Nada entra sem confirmação numa API.** Toda sugestão da IA é verificada na Open Library (e, se ela falhar, na Google Books) antes de virar linha do catálogo — modelo pequeno inventa título com convicção.

A deduplicação é por **work key** da Open Library (`/works/OL…W`), que identifica a obra independente do idioma: *Atomic Habits* e *Hábitos Atômicos* têm a mesma chave e não entram duas vezes. Livros antigos sem chave são resolvidos aos poucos (12 por rodada em `discover`, 200 em `prune`) para não martelar a API. `--prune` remove duplicatas que já tenham entrado, mantendo a edição já postada e, no empate, a de título em português.

## Rodízio e estado

O SQLite tem uma tabela `books`:

| Coluna | Papel |
|---|---|
| `slug` | `título-autor` normalizado, chave primária |
| `title`, `author`, `category` | metadados do catálogo, atualizados no boot |
| `rounds` | quantas vezes foi postado |
| `posted_at` | ISO da última publicação |
| `work_key` | identidade da obra na Open Library |

O índice `idx_books_rotation` em `(rounds, posted_at)` é o que sustenta a consulta do rodízio. Bancos criados antes da deduplicação recebem a coluna `work_key` por `ALTER TABLE` no boot.

## Sem IA, sem token

O bot degrada em vez de quebrar:

- **IA fora ou sem chave.** `enrich()` cai no fallback: sinopse vinda da descrição da editora (até 600 caracteres), sem tagline, sem resumo em tópicos, sem curiosidades, sem frase e sem "para quem é". O post sai menor, mas sai. A descoberta também para de funcionar: sem IA para filtrar, os lotes da busca por assunto são descartados e nenhum livro novo entra.
- **Sem capa.** Vale o post só-texto. A capa só é usada se a URL responder `image/*` com mais de 3.000 bytes — a Open Library devolve um GIF de 1 pixel quando não tem a imagem, e o Telegram rejeita link quebrado.
- **Markdown recusado.** O envio tenta `parse_mode: Markdown`; se o Telegram responder erro, o mesmo trecho é reenviado puro. Se o `sendPhoto` falhar, a legenda vira mensagem de texto.
- **Sem token/chat.** Nada é enviado: o post é impresso no console, com a URL da capa. Mas o livro é marcado como postado do mesmo jeito — para testar sem consumir o rodízio, use `--preview`.

## Testes

Não há suíte de testes no repositório — `package.json` não define script `test`. As verificações possíveis são:

```bash
bun run typecheck
bun run lint
bun run preview
```

`bun run lint` usa Biome 2.5.2 e roda com `--write`: ele corrige os arquivos em vez de só reportar. Não existe workflow de CI em `.github/workflows/`.

## Limitações

- **Depende de APIs públicas sem chave.** A Google Books devolve `429` com frequência sem API key; por isso existe a Open Library, que estrangula clientes anônimos e exige um `User-Agent` identificável — o bot manda `livro-do-dia/1.0 (github.com/juninmd/livro-do-dia)` e repete uma vez após 2 s.
- **A IA pode alucinar.** As travas são validação em API para livros e proibição de fatos biográficos no prompt. Sinopse e resumo ainda são texto gerado: não são a orelha da editora.
- **O link de compra é uma busca**, não a página do livro. ASIN muda por edição e o ISBN que as APIs devolvem costuma ser da edição em inglês, que não existe na loja brasileira. Por isso o link é `amazon.com.br/s?k=<título + autor>&i=stripbooks`, opcionalmente com a tag de afiliado.
- **O texto que sai da máquina:** título, autor, categoria e trecho da descrição da editora vão para o endpoint de IA; título e autor vão para a Google Books, a Open Library e a Amazon; e o post montado, com a URL da capa, vai para o Telegram. O banco e o token ficam locais.
- **Descoberta é lenta por natureza.** Cada candidato custa uma ou mais chamadas HTTP; `discover()` busca no máximo 5 livros por execução e desiste cedo quando a cota fecha.
- **Um post por execução.** O `--loop` agenda, mas não há fila nem retry. Se o envio falhar, o erro é logado e o livro é marcado como postado mesmo assim — a indicação se perde e não volta na próxima rodada.
- **Fuso fixo.** O cron usa `America/Sao_Paulo` e a data do post usa o mesmo fuso; rodar em outra região não muda o horário do agendamento.

## Licença

Não há arquivo de licença neste repositório.
