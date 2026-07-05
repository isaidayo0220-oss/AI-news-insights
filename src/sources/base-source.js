import { fetchFeed } from "../lib/rss-parser.js";

/**
 * すべての情報源プラグインが実装すべき最小インターフェース。
 *
 * 新しい情報源を追加する場合は、このファイルを直接編集する必要はありません。
 * `createRssSource()` を呼び出す新しいファイルを src/sources/ に追加し、
 * src/sources/index.js の一覧に登録するだけで拡張できます。
 *
 * @typedef {Object} NormalizedArticle
 * @property {string} id            記事の一意なID（URLのハッシュ等）
 * @property {string} sourceId      情報源ID
 * @property {string} sourceName    情報源の表示名
 * @property {string} title         記事タイトル
 * @property {string} url           記事URL
 * @property {string} publishedAt   ISO8601形式の公開日時
 * @property {string} excerpt       抜粋（RSSのdescription等）
 *
 * @typedef {Object} NewsSource
 * @property {string} id
 * @property {string} name
 * @property {string} homepage
 * @property {() => Promise<NormalizedArticle[]>} fetchItems
 */

/**
 * RSS/Atomフィードを情報源として扱うための共通ファクトリ。
 * 「利用規約・robots.txtを遵守した公式配信チャンネル」であるRSSのみを
 * 前提としており、HTMLスクレイピングは行わない設計です。
 *
 * @param {Object} config
 * @param {string} config.id 情報源の一意なID (例: "itmedia")
 * @param {string} config.name 表示名 (例: "ITmedia NEWS")
 * @param {string} config.feedUrl 公式RSS/AtomフィードのURL
 * @param {string} config.homepage 情報源のトップページURL（出典表示用）
 * @returns {NewsSource}
 */
export function createRssSource({ id, name, feedUrl, homepage }) {
  if (!id || !name || !feedUrl) {
    throw new Error("createRssSource requires id, name, and feedUrl");
  }

  return {
    id,
    name,
    homepage: homepage ?? feedUrl,

    async fetchItems() {
      const items = await fetchFeed(feedUrl);
      return items.map((item) => normalizeItem(item, { id, name }));
    },
  };
}

/**
 * rss-parserが返す生アイテムを、アプリ内共通のスキーマへ変換する。
 * @param {import("rss-parser").Item} item
 * @param {{id: string, name: string}} source
 * @returns {NormalizedArticle}
 */
function normalizeItem(item, source) {
  const url = item.link ?? "";
  const publishedAt = item.isoDate ?? safeToIso(item.pubDate) ?? new Date(0).toISOString();

  return {
    id: buildArticleId(source.id, url || item.title || ""),
    sourceId: source.id,
    sourceName: source.name,
    title: (item.title ?? "(無題)").trim(),
    url,
    publishedAt,
    excerpt: cleanExcerpt(item.contentSnippet ?? item.content ?? ""),
  };
}

function safeToIso(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function cleanExcerpt(text) {
  return text.replace(/\s+/g, " ").trim().slice(0, 300);
}

/**
 * URL(またはタイトル)から安定したID文字列を生成する。
 * 外部ハッシュライブラリに依存しない簡易ハッシュ。
 */
export function buildArticleId(sourceId, key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return `${sourceId}:${hash.toString(16)}`;
}
