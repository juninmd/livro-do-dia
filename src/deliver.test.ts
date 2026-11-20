import { describe, expect, test } from "bun:test";
import { deliverPost } from "./deliver.ts";

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
