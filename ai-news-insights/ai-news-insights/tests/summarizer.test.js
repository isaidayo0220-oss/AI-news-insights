import { describe, it, expect, vi } from "vitest";
import { generateDailySummary } from "../src/lib/summarizer.js";

function makeArticle(overrides = {}) {
  return {
    id: "itmedia:abc123",
    sourceId: "itmedia",
    sourceName: "ITmedia NEWS",
    title: "サンプル記事",
    url: "https://example.com/1",
    publishedAt: "2026-07-05T00:00:00.000Z",
    excerpt: "本文抜粋",
    ...overrides,
  };
}

describe("generateDailySummary", () => {
  it("APIキーが無い場合はavailable:falseを返す", async () => {
    const result = await generateDailySummary([makeArticle()], { apiKey: undefined });
    expect(result.available).toBe(false);
    expect(result.error).toMatch(/GEMINI_API_KEY/);
  });

  it("記事が0件の場合はavailable:falseを返す", async () => {
    const result = await generateDailySummary([], { apiKey: "dummy-key" });
    expect(result.available).toBe(false);
  });

  it("正常応答時はoverviewとhighlightsを解析して返す", async () => {
    const fakeResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  overview: "本日はAI関連の発表が多い一日でした。",
                  highlights: [
                    { articleId: "itmedia:abc123", title: "サンプル記事", reason: "業界への影響が大きいため" },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fakeResponse,
    });

    const result = await generateDailySummary([makeArticle()], { apiKey: "dummy-key", fetchImpl });

    expect(result.available).toBe(true);
    expect(result.overview).toContain("AI関連");
    expect(result.highlights).toHaveLength(1);
    expect(result.highlights[0].articleId).toBe("itmedia:abc123");
  });

  it("HTTPエラー時はフォールバックする", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    const result = await generateDailySummary([makeArticle()], { apiKey: "dummy-key", fetchImpl });

    expect(result.available).toBe(false);
    expect(result.error).toMatch(/429/);
  });

  it("JSON解析に失敗した場合もフォールバックし、例外を投げない", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{ 壊れたJSON" }] } }],
      }),
    });

    const result = await generateDailySummary([makeArticle()], { apiKey: "dummy-key", fetchImpl });

    expect(result.available).toBe(false);
    expect(result.error).toMatch(/AI要約生成に失敗/);
  });
});
