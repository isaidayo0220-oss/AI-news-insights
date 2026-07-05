import Parser from "rss-parser";

const parser = new Parser({
  timeout: 15_000,
  headers: {
    // 収集主体を明示する。多くのニュースサイトのRSSは外部配信を
    // 目的として公開されているが、UAを名乗るのはマナーとして遵守する。
    "User-Agent": "ai-news-insights-bot/1.0 (+https://github.com/)",
  },
});

/**
 * 指定したRSS/AtomフィードURLを取得し、アイテム配列を返す。
 * ネットワークエラーやパース失敗時は例外を投げず、空配列を返して
 * 他の情報源の収集を止めない（1情報源の障害が全体を落とさない設計）。
 *
 * @param {string} feedUrl
 * @returns {Promise<import("rss-parser").Item[]>}
 */
export async function fetchFeed(feedUrl) {
  try {
    const feed = await parser.parseURL(feedUrl);
    return feed.items ?? [];
  } catch (error) {
    console.error(`[rss-parser] フィード取得に失敗: ${feedUrl}`, error.message);
    return [];
  }
}
