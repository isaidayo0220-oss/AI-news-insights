import { describe, it, expect } from "vitest";
import { buildReport } from "../src/lib/report-builder.js";

describe("buildReport", () => {
  it("記事・AI要約・情報源一覧を1つのレポートにまとめる", () => {
    const report = buildReport({
      articles: [{ id: "a1", title: "記事1" }],
      aiSummary: { available: true, overview: "要約", highlights: [] },
      sources: [{ id: "itmedia", name: "ITmedia NEWS", homepage: "https://www.itmedia.co.jp/" }],
      generatedAt: new Date("2026-07-05T09:00:00.000Z"),
    });

    expect(report.generatedAt).toBe("2026-07-05T09:00:00.000Z");
    expect(report.articleCount).toBe(1);
    expect(report.articles).toHaveLength(1);
    expect(report.sources[0].id).toBe("itmedia");
    expect(report.aiSummary.overview).toBe("要約");
  });
});
