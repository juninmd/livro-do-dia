import { afterEach, describe, expect, test } from "bun:test";
import { env } from "./config/env.ts";
import { sendTelegram, sendTelegramPhoto, split } from "./telegram.ts";

describe("split", () => {
  test("texto curto sai inteiro", () => {
    expect(split("a\nb", 10)).toEqual(["a\nb"]);
  });

  test("quebra entre linhas e nenhum pedaço passa do limite", () => {
    const text = Array.from({ length: 40 }, (_, i) => `linha ${i}`).join("\n");
    const parts = split(text, 50);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(50);
    expect(parts.join("").replace(/\n/g, "")).toBe(text.replace(/\n/g, ""));
  });

  test("linha maior que o limite não gera pedaço vazio nem estoura o limite", () => {
    const parts = split("x".repeat(25), 10);
    expect(parts.every((p) => p.trim().length > 0)).toBe(true);
    expect(parts.every((p) => p.length <= 10)).toBe(true);
    expect(parts.join("").replace(/\n/g, "")).toBe("x".repeat(25));
  });

  test("linha gigante depois de texto também respeita o limite", () => {
    const parts = split(`curto\n${"y".repeat(30)}`, 12);
    expect(parts.every((p) => p.length > 0 && p.length <= 12)).toBe(true);
  });
});

describe("entrega", () => {
  const realFetch = globalThis.fetch;
  const calls: { method: string; chat: unknown }[] = [];

  function mockFetch(failPhotoFor: string | null, failAllText: boolean) {
    env.telegramToken = "t";
    env.telegramChatIds = ["A", "B"];
    globalThis.fetch = (async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body);
      const method = String(url).split("/").pop() as string;
      calls.push({ method, chat: body.chat_id });
      const fail = method === "sendPhoto" ? body.chat_id === failPhotoFor : failAllText;
      return new Response("x", { status: fail ? 400 : 200 });
    }) as unknown as typeof fetch;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
    env.telegramToken = "";
    env.telegramChatIds = [];
    calls.length = 0;
  });

  test("foto que falha em um chat vira texto só nele, sem duplicar no outro", async () => {
    mockFetch("A", false);
    expect(await sendTelegramPhoto("http://img", "legenda")).toBe(true);
    const textTo = calls.filter((c) => c.method === "sendMessage").map((c) => c.chat);
    expect(textTo).toEqual(["A"]);
  });

  test("retorna false quando nenhum chat recebe", async () => {
    mockFetch(null, true);
    expect(await sendTelegram("oi")).toBe(false);
  });
});
