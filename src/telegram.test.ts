import { describe, expect, test } from "bun:test";
import { split } from "./telegram.ts";

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
