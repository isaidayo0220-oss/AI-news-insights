import { callGemini, GeminiError } from "./gemini-client.js";

const DEFAULT_ANALYSIS_POLICY =
  "あなたは世界トップクラスの戦略コンサルタント兼業界アナリストです。事実と推測を明確に分け、簡潔で読みやすい分析を行ってください。";

const CATEGORY_OPTIONS = ["AI", "半導体", "通信", "自動車", "DX", "金融", "製造", "エネルギー", "政策", "海外", "その他"];

/**
 * 1件の記事について、構造化された詳細分析(戦略コンサル視点)を生成する。
 *
 * summarizer.jsと同様に、内容はJSONスキーマで厳密に構造化してAIから受け取り、
 * 見出しや文言などの「レイアウト」はコード側(js/app.js)で固定的に組み立てる。
 * これにより、AIが複雑なMarkdown見出しフォーマットの指示に従いきれず崩れる、
 * という自由形式出力特有の問題を構造的に回避している。
 *
 * config/deep-dive-prompt.mdで自由に変更できるのは「分析方針・視点・トーン」の部分のみ。
 * 出力される項目(3行要約/重要ポイント/キーワード/カテゴリ/重要度/コンサル視点/イシュー/
 * 仮説/ビジネスへの影響/アクション/読書ノート)の構造自体は固定。
 *
 * @param {import("../sources/base-source.js").NormalizedArticle} article
 * @param {Object} [options]
 * @param {string} [options.customInstructions] config/deep-dive-prompt.mdから渡される分析方針
 * @param {string} [options.apiKey]
 * @param {string} [options.model]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<DeepDiveResult>}
 *
 * @typedef {Object} DeepDiveResult
 * @property {boolean} available
 * @property {DeepDiveAnalysis|null} analysis
 * @property {string} [error]
 *
 * @typedef {Object} DeepDiveAnalysis
 * @property {string} summary
 * @property {string[]} keyPoints
 * @property {string[]} keywords
 * @property {string} category
 * @property {number} importanceStars 0〜5
 * @property {string} importanceReason
 * @property {string[]} consultantPoints
 * @property {string} issue
 * @property {string[]} hypotheses
 * @property {{company: string, consumer: string, market: string, economy: string}} businessImpact
 * @property {string[]} actions
 * @property {{learning: string, insight: string, tomorrow: string}} readingNotes
 */
export async function generateDeepDive(article, options = {}) {
  const policy = (options.customInstructions ?? "").trim() || DEFAULT_ANALYSIS_POLICY;
  const prompt = buildPrompt(article, policy);

  try {
    const text = await callGemini(prompt, {
      apiKey: options.apiKey,
      model: options.model,
      fetchImpl: options.fetchImpl,
      responseMimeType: "application/json",
    });

    const parsed = JSON.parse(text);
    return { available: true, analysis: normalize(parsed) };
  } catch (error) {
    const message = error instanceof GeminiError ? error.message : `詳細分析の生成に失敗: ${error.message}`;
    return { available: false, analysis: null, error: message };
  }
}

function buildPrompt(article, policy) {
  return [
    "【分析方針】(ユーザーが自由に設定した指示です。他の指示より優先して考慮してください)",
    policy,
    "",
    "以下のニュース記事を分析し、次のJSONスキーマに厳密に従って出力してください。",
    "JSON以外の文字列(前置き・Markdown記法・コードブロックのバッククォート等)は一切出力しないでください。",
    "各項目は事実と推測を区別し、簡潔にまとめてください。",
    "{",
    '  "summary": "記事全体を3行程度で要約した文章",',
    '  "keyPoints": ["重要ポイントを3つ程度の配列"],',
    '  "keywords": ["キーワードを5つ程度の配列"],',
    `  "category": "次のいずれか1つ: ${CATEGORY_OPTIONS.join("/")}",`,
    '  "importanceStars": "重要度を1〜5の整数で",',
    '  "importanceReason": "重要度の理由を1文で",',
    '  "consultantPoints": ["企業が考えるべき論点を3つ程度の配列"],',
    '  "issue": "この記事から最も重要だと考えられるイシューを1文で",',
    '  "hypotheses": ["記事だけでは断定できないが今後起こり得ることの予測を3つ程度の配列"],',
    '  "businessImpact": { "company": "企業への影響", "consumer": "消費者への影響", "market": "市場への影響", "economy": "日本経済への影響" },',
    '  "actions": ["この記事を読んだ人が次に調べるべきことを3つ程度の配列"],',
    '  "readingNotes": { "learning": "学び", "insight": "気づき", "tomorrow": "明日の業務・学習で活かせること" }',
    "}",
    "",
    "# 記事",
    `タイトル: ${article.title}`,
    `情報源: ${article.sourceName}`,
    `URL: ${article.url}`,
    `本文抜粋: ${article.excerpt}`,
  ].join("\n");
}

function normalize(parsed) {
  return {
    summary: String(parsed.summary ?? ""),
    keyPoints: toStringArray(parsed.keyPoints),
    keywords: toStringArray(parsed.keywords),
    category: String(parsed.category ?? ""),
    importanceStars: clampStars(parsed.importanceStars),
    importanceReason: String(parsed.importanceReason ?? ""),
    consultantPoints: toStringArray(parsed.consultantPoints),
    issue: String(parsed.issue ?? ""),
    hypotheses: toStringArray(parsed.hypotheses),
    businessImpact: {
      company: String(parsed.businessImpact?.company ?? ""),
      consumer: String(parsed.businessImpact?.consumer ?? ""),
      market: String(parsed.businessImpact?.market ?? ""),
      economy: String(parsed.businessImpact?.economy ?? ""),
    },
    actions: toStringArray(parsed.actions),
    readingNotes: {
      learning: String(parsed.readingNotes?.learning ?? ""),
      insight: String(parsed.readingNotes?.insight ?? ""),
      tomorrow: String(parsed.readingNotes?.tomorrow ?? ""),
    },
  };
}

function toStringArray(value) {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function clampStars(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, Math.round(n)));
}
