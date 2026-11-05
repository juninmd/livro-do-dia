import { env } from "./config/env.ts";

/** Single-shot chat completion across providers. Returns plain text. */
export async function chat(system: string, user: string): Promise<string> {
  switch (env.aiProvider) {
    case "anthropic":
      return anthropic(system, user);
    case "google":
      return google(system, user);
    case "ollama":
      return openaiCompatible(env.ollamaBaseUrl, "ollama", env.ollamaModel, system, user);
    default:
      return openaiCompatible(
        env.openaiBaseUrl,
        env.openaiKey,
        env.openaiModel,
        system,
        user,
      );
  }
}

const signal = () => AbortSignal.timeout(env.aiTimeoutMs);

async function openaiCompatible(
  baseUrl: string,
  key: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.5,
    }),
    signal: signal(),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content?.trim() ?? "";
}

async function anthropic(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
    signal: signal(),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content: { text: string }[] };
  return json.content[0]?.text?.trim() ?? "";
}

async function google(system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent?key=${env.geminiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
    }),
    signal: signal(),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as {
    candidates: { content: { parts: { text: string }[] } }[];
  };
  return json.candidates[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

/**
 * Chat que precisa devolver JSON. Modelos pequenos erram o formato de vez em
 * quando — uma segunda tentativa costuma resolver e sai mais barato que
 * perder o post do dia.
 */
export async function chatJson<T>(
  system: string,
  user: string,
  attempts = 2,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return parseJsonObject<T>(await chat(system, user));
    } catch (err) {
      last = err;
      console.error(`[ai] tentativa ${i + 1}/${attempts} falhou: ${err}`);
    }
  }
  throw last;
}

/** Extrai o primeiro objeto JSON de uma resposta (tolera cercas ``` e ruído). */
export function parseJsonObject<T>(raw: string): T {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("resposta sem JSON");
  const body = raw
    .slice(start, end + 1)
    // modelos pequenos emitem escapes \u inválidos que quebram o JSON.parse
    .replace(/\\u(?![0-9a-fA-F]{4})/g, "u")
    // ...e vírgula sobrando antes de fechar objeto/array
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(body) as T;
}
