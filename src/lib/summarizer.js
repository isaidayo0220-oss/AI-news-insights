const DEFAULT_MODEL = "gemini-1.5-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * 記事一覧をAIに渡し、日次サマリーを生成する。
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
 * @returns {Promise<AiSummary>}
 *
 * @typedef {Object} AiSummary
 * @property {boolean} available AI要約が生成できたか
 * @property {string} overview 全体の傾向を要約した文章
 * @property {{title: string, reason: string, articleId: string}[]} highlights 注目記事とその理由
 * @property {string} [error] 生成できなかった場合の理由
 */
export async function generateDailySummary(articles, options = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? DEFAULT_MODEL;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) {
    return fallbackSummary("GEMINI_API_KEYが設定されていません");
  }
  if (articles.length === 0) {
    return fallbackSummary("要約対象の記事がありません");
  }

  const prompt = buildPrompt(articles);

  try {
    const response = await fetchImpl(
      `${API_BASE}/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!response.ok) {
      return fallbackSummary(`Gemini APIエラー: HTTP ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return fallbackSummary("Gemini APIから空の応答");
    }

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
    return fallbackSummary(`AI要約生成に失敗: ${error.message}`);
  }
}

function buildPrompt(articles) {
  const list = articles
    .slice(0, 40)
    .map((a, i) => `${i + 1}. [id:${a.id}] (${a.sourceName}) ${a.title}\n   ${a.excerpt}`)
    .join("\n");

  return [
    "あなたはIT/テクノロジー分野のニュース編集者です。",
    "以下は本日収集された記事一覧です。これらを読み、日本語で分析してください。",
    "",
    list,
    "",
    "出力は次のJSONスキーマに厳密に従い、JSON以外の文字列は一切出力しないでください:",
    "{",
    '  "overview": "本日のニュース全体の傾向・注目トピックを3〜5文でまとめた文章",',
    '  "highlights": [',
    '    { "articleId": "上記のid", "title": "記事タイトル", "reason": "なぜ注目すべきかを1〜2文で" }',
    "  ]",
    "}",
    "highlightsは重要度の高い記事を最大5件、articleIdは必ず入力の[id:...]の値をそのまま使ってください。",
  ].join("\n");
}

function fallbackSummary(error) {
  return { available: false, overview: "", highlights: [], error };
}
