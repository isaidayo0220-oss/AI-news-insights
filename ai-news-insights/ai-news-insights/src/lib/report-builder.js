/**
 * 収集結果とAI要約を、フロントエンドが表示する最終的なレポートJSONにまとめる。
 *
 * @param {Object} params
 * @param {import("../sources/base-source.js").NormalizedArticle[]} params.articles
 * @param {import("./summarizer.js").AiSummary} params.aiSummary
 * @param {{id: string, name: string, homepage: string}[]} params.sources
 * @param {Date} [params.generatedAt]
 */
export function buildReport({ articles, aiSummary, sources, generatedAt = new Date() }) {
  return {
    generatedAt: generatedAt.toISOString(),
    sources: sources.map((s) => ({ id: s.id, name: s.name, homepage: s.homepage })),
    articleCount: articles.length,
    aiSummary,
    articles,
  };
}
