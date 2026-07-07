import { callGemini, GeminiError } from "./gemini-client.js";

const DEFAULT_EDITORIAL_POLICY =
  "IT/テクノロジー分野のニュースとして、全体の傾向を客観的にまとめてください。特に影響範囲が広いニュースを優先してください。";

/**
 * 記事一覧をAIに渡し、日次サマリー(全体傾向+注目記事Top5)を生成する。
 *
 * 失敗時（APIキー未設定・レート制限・JSON解析失敗など）は例外を投げず、
 * `fallbackSummary` を返す。AI分析はあくまで付加価値であり、
 * その失敗によって記事収集パイプライン全体を止めない設計。
 *
 * @param {import("../sources/base-source.js").NormalizedArticle[]} articles
 * @param {Object} [options]
 * @param {string} [options.apiKey] 未指定時は process.env.GEMINI_API_KEY を使用
 * @param {string} [options.model]
 * @param {typeof fetch} [options.fetchImpl] テスト用の差し替え
 * @param {string} [options.customInstructions] AIへの追加指示(config/prompt.mdから渡される)
 * @param {number} [options.maxRetries] 429時の最大リトライ回数(callGeminiへそのまま橋渡し)
 * @param {number} [options.retryDelayMs] 429時の基本待機時間ms(callGeminiへそのまま橋渡し)
 * @returns {Promise<AiSummary>}
 *
 * @typedef {Object} AiSummary
 * @property {boolean} available AI要約が生成できたか
 * @property {string} overview 全体の傾向を要約した文章
 * @property {{title: string, reason: string, articleId: string}[]} highlights 注目記事とその理由
 * @property {string} [error] 生成できなかった場合の理由
 */
export async function generateDailySummary(articles, options = {}) {
  if (articles.length === 0) {
    return fallbackSummary("要約対象の記事がありません");
  }

  const prompt = buildPrompt(articles, options.customInstructions ?? "");

  try {
    const text = await callGemini(prompt, {
      apiKey: options.apiKey,
      model: options.model,
      fetchImpl: options.fetchImpl,
      responseMimeType: "application/json",
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
    });

    const parsed = JSON.parse(text);
    return {
      available: true,
      overview: String(parsed.overview ?? "").trim(),
      highlights: Array.isArray(parsed.highlights)
        ? parsed.highlights.slice(0, 5).map((h) => ({
            title: String(h.title ?? ""),
            reason: String(h.reason ?? ""),
            articleId: String(h.articleId ?? ""),
          }))
        : [],
    };
  } catch (error) {
    const message = error instanceof GeminiError ? error.message : `AI要約生成に失敗: ${error.message}`;
    return fallbackSummary(message);
  }
}

function buildPrompt(articles, customInstructions) {
  const list = articles
    .slice(0, 40)
    .map((a, i) => `${i + 1}. <<${a.id}>> (${a.sourceName}) ${a.title}\n   ${a.excerpt}`)
    .join("\n");

  const editorialPolicy = customInstructions.trim() || DEFAULT_EDITORIAL_POLICY;

  return [
    "あなたはニュース編集者です。以下の【編集方針】に従って、本日収集された記事一覧を日本語で分析してください。",
    "",
    "【編集方針】(ここはユーザーが自由に設定した指示です。他の指示より優先して考慮してください)",
    editorialPolicy,
    "",
    "【記事一覧】各行の <<...>> の中身がその記事の識別子(id)です。",
    list,
    "",
    "出力は次のJSONスキーマに厳密に従い、JSON以外の文字列は一切出力しないでください:",
    "{",
    '  "overview": "本日のニュース全体の傾向・注目トピックを3〜5文でまとめた文章",',
    '  "highlights": [',
    '    { "articleId": "該当記事の<<>>内の文字列のみ(<<や>>自体は含めない)", "title": "記事タイトル", "reason": "なぜ注目すべきかを1〜2文で" }',
    "  ]",
    "}",
    "highlightsは重要度の高い記事を最大5件、articleIdは必ず入力の<<...>>の中身をそのまま使ってください（\"id:\"のような接頭辞や記号を付け加えないでください）。",
  ].join("\n");
}

function fallbackSummary(error) {
  return { available: false, overview: "", highlights: [], error };
}
