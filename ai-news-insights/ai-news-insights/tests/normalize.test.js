import { describe, it, expect } from "vitest";
import { mergeAndDedupe, groupBySource } from "../src/lib/normalize.js";

function makeArticle(overrides = {}) {
  return {
    id: "a1",
    sourceId: "itmedia",
    sourceName: "ITmedia NEWS",
    title: "サンプル記事",
    url: "https://example.com/1",
    publishedAt: "2026-07-05T00:00:00.000Z",
    excerpt: "本文抜粋",
    ...overrides,
  };
}

describe("mergeAndDedupe", () => {
  it("同一URLの記事は新しい方を残して重複排除する", () => {
    const older = makeArticle({ publishedAt: "2026-07-04T00:00:00.000Z", title: "旧タイトル" });
    const newer = makeArticle({ publishedAt: "2026-07-05T00:00:00.000Z", title: "新タイトル" });

    const result = mergeAndDedupe([older, newer]);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("新タイトル");
  });

  it("公開日時の降順にソートする", () => {
    const a = makeArticle({ url: "https://example.com/a", publishedAt: "2026-07-01T00:00:00.000Z" });
    const b = makeArticle({ url: "https://example.com/b", publishedAt: "2026-07-05T00:00:00.000Z" });
    const c = makeArticle({ url: "https://example.com/c", publishedAt: "2026-07-03T00:00:00.000Z" });

    const result = mergeAndDedupe([a, b, c]);

    expect(result.map((r) => r.url)).toEqual([
      "https://example.com/b",
      "https://example.com/c",
      "https://example.com/a",
    ]);
  });

  it("limitオプションで件数を制限する", () => {
    const articles = Array.from({ length: 10 }, (_, i) =>
      makeArticle({ url: `https://example.com/${i}`, publishedAt: new Date(2026, 0, i + 1).toISOString() }),
    );

    const result = mergeAndDedupe(articles, { limit: 3 });

    expect(result).toHaveLength(3);
  });
});

describe("groupBySource", () => {
  it("sourceIdごとに記事をグルーピングする", () => {
    const a = makeArticle({ sourceId: "itmedia", url: "https://example.com/a" });
    const b = makeArticle({ sourceId: "gigazine", url: "https://example.com/b" });
    const c = makeArticle({ sourceId: "itmedia", url: "https://example.com/c" });

    const groups = groupBySource([a, b, c]);

    expect(groups.get("itmedia")).toHaveLength(2);
    expect(groups.get("gigazine")).toHaveLength(1);
  });
});
