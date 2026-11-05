import cron from "node-cron";
import { env } from "./config/env.ts";
import { syncCatalog } from "./db.ts";
import { discover, pruneDuplicates } from "./discover.ts";
import { postDaily } from "./post.ts";

const args = new Set(process.argv.slice(2));

syncCatalog();

async function daily() {
  await discover().catch((err) => console.error(`[discover] ${err}`));
  await postDaily();
}

if (args.has("--discover")) {
  await discover();
} else if (args.has("--prune")) {
  await pruneDuplicates();
} else if (args.has("--preview")) {
  await postDaily(true);
} else if (args.has("--post")) {
  await daily();
} else if (args.has("--loop")) {
  console.log(`[livro-do-dia] agente ativo — post diário: ${env.cronPost}`);
  cron.schedule(env.cronPost, () => daily().catch(console.error), {
    timezone: "America/Sao_Paulo",
  });
} else {
  await daily();
  process.exit(0);
}
