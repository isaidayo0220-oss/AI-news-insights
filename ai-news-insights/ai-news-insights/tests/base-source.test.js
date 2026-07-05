import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/rss-parser.js", () => ({
  fetchFeed: vi.fn(),
}));

import { fetchFeed } from "../src/lib/rss-parser.js";
import { createRssSource, buildArticleId } from "../src/sources/base-source.js";

describe("createRssSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("id/name/feedUrlが無いと例外を投げる", () => {
    expect(() => createRssSource({ name: "x", feedUrl: "https://x" })).toThrow();
  });

  it("fetchItemsが生のRSSアイテムを正規化された記事に変換する", async () => {
    fetchFeed.mockResolvedValue([
      {
        title: "  テスト記事  ",
        link: "https://example.com/1",
        isoDate: "2026-07-05T00:00:00.000Z",
        contentSnippet: "  本文    抜粋  です  ",
      },
    ]);

    const source = createRssSource({
      id: "test",
      name: "テスト情報源",
      feedUrl: "https://example.com/rss",
    });

    const items = await source.fetchItems();

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      sourceId: "test",
      sourceName: "テスト情報源",
      title: "テスト記事",
      url: "https://example.com/1",
      publishedAt: "2026-07-05T00:00:00.000Z",
      excerpt: "本文 抜粋 です",
    });
    expect(items[0].id).toBe(buildArticleId("test", "https://example.com/1"));
  });

  it("タイトルが無い場合は「(無題)」にフォールバックする", async () => {
    fetchFeed.mockResolvedValue([{ link: "https://example.com/2" }]);
    const source = createRssSource({ id: "t", name: "T", feedUrl: "https://x" });

    const items = await source.fetchItems();

    expect(items[0].title).toBe("(無題)");
  });

  it("pubDateが不正な場合はUNIXエポックにフォールバックする", async () => {
    fetchFeed.mockResolvedValue([{ title: "x", link: "https://x", pubDate: "invalid-date" }]);
    const source = createRssSource({ id: "t", name: "T", feedUrl: "https://x" });

    const items = await source.fetchItems();

    expect(items[0].publishedAt).toBe(new Date(0).toISOString());
  });
});

describe("buildArticleId", () => {
  it("同じ入力に対して常に同じIDを返す(決定的)", () => {
    const a = buildArticleId("itmedia", "https://example.com/1");
    const b = buildArticleId("itmedia", "https://example.com/1");
    expect(a).toBe(b);
  });

  it("sourceIdが異なれば同じURLでも異なるIDになる", () => {
    const a = buildArticleId("itmedia", "https://example.com/1");
    const b = buildArticleId("gigazine", "https://example.com/1");
    expect(a).not.toBe(b);
  });
});
