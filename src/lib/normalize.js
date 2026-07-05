/**
 * 複数情報源から集めた記事配列をマージし、以下を行う:
 *   - URL基準での重複排除（同じ記事が複数フィードに出るケースを吸収）
 *   - 公開日時の降順ソート
 *   - 上限件数での切り詰め
 *
 * 副作用のない純粋関数として実装し、ユニットテストしやすくしている。
 *
 * @param {import("../sources/base-source.js").NormalizedArticle[]} articles
 * @param {{ limit?: number }} [options]
 * @returns {import("../sources/base-source.js").NormalizedArticle[]}
 */
export function mergeAndDedupe(articles, { limit = 100 } = {}) {
  const seen = new Map();

  for (const article of articles) {
    const key = article.url || article.id;
    const existing = seen.get(key);
    if (!existing || new Date(article.publishedAt) > new Date(existing.publishedAt)) {
      seen.set(key, article);
    }
  }

  return [...seen.values()]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, limit);
}

/**
 * 記事配列を情報源(sourceId)ごとにグルーピングする。フロントエンド表示用。
 * @param {import("../sources/base-source.js").NormalizedArticle[]} articles
 */
export function groupBySource(articles) {
  const groups = new Map();
  for (const article of articles) {
    const list = groups.get(article.sourceId) ?? [];
    list.push(article);
    groups.set(article.sourceId, list);
  }
  return groups;
}
