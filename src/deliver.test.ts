import { describe, expect, test } from "bun:test";
import { CAPTION_MAX, deliverPost, layoutPost } from "./deliver.ts";

const post = {
  cover: "https://capa",
  caption: "HEADER",
  full: "HEADER\n\nSECOES",
  rest: "SECOES",
};

function recorder(photoOk: boolean) {
  const sent: string[] = [];
  return {
    sent,
    send: {
      photo: async (_url: string, caption: string) => {
        sent.push(`photo:${caption}`);
        return photoOk;
      },
      text: async (text: string) => {
        sent.push(`text:${text}`);
        return true;
      },
    },
  };
}

describe("deliverPost", () => {
  test("capa aceita: foto com cabeçalho e depois a continuação", async () => {
    const r = recorder(true);
    expect(await deliverPost(post, r.send)).toBe(true);
    expect(r.sent).toEqual(["photo:HEADER", "text:SECOES"]);
  });

  test("capa recusada: post completo em texto, nunca só a continuação", async () => {
    const r = recorder(false);
    expect(await deliverPost(post, r.send)).toBe(true);
    expect(r.sent).toEqual(["photo:HEADER", "text:HEADER\n\nSECOES"]);
  });

  test("sem capa: só texto", async () => {
    const r = recorder(true);
    expect(await deliverPost({ ...post, cover: "" }, r.send)).toBe(true);
    expect(r.sent).toEqual(["text:HEADER\n\nSECOES"]);
  });
});

describe("layoutPost", () => {
  test("post curto vai inteiro na legenda", () => {
    const p = layoutPost("cabeçalho", "\n💥 gancho", "seções");
    expect(p.caption).toBe("cabeçalho\n\n💥 gancho\n\nseções");
    expect(p.rest).toBe("");
  });

  test("post longo: cabeçalho e gancho na legenda, seções na continuação", () => {
    const sections = "s".repeat(2000);
    const p = layoutPost("cabeçalho", "\n💥 gancho", sections);
    expect(p.caption).toBe("cabeçalho\n\n💥 gancho");
    expect(p.rest).toBe(sections);
  });

  test("gancho gigante desce para a continuação em vez de ser cortado", () => {
    const tagline = `\n💥 ${"g".repeat(1100)}`;
    const p = layoutPost("cabeçalho", tagline, "seções");
    expect(p.caption).toBe("cabeçalho");
    expect(p.rest).toBe(`${tagline.trim()}\n\nseções`);
    expect(p.caption.length).toBeLessThanOrEqual(CAPTION_MAX);
  });
});
