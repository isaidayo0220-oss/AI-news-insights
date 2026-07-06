const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini API呼び出しに関するエラー。呼び出し元がフォールバック処理に使うため、
 * 通常のErrorと区別できるようにしている。
 */
export class GeminiError extends Error {}

/**
 * Gemini APIの generateContent を呼び出し、応答テキストをそのまま返す低レベル関数。
 * JSON出力を強制するかどうか(responseMimeType)は呼び出し元に委ねる。
 *
 * 注意: Gemini 2.5系モデルはデフォルトで「内部思考(thinking)」が有効になっており、
 * thinkingConfigを指定しないと思考トークンがmaxOutputTokensの予算を消費してしまい、
 * 本来の回答が空・途中で切れる・支離滅裂になることがある(Google側の既知の挙動)。
 * このアプリの用途(分類・要約・フォーマット整形)では複雑な推論を必要としないため、
 * デフォルトで思考を無効化(thinkingBudget: 0)し、確実に完全な出力を得られるようにしている。
 *
 * 失敗時は必ず GeminiError を投げる（呼び出し元でtry/catchしてフォールバックする想定）。
 *
 * @param {string} prompt
 * @param {Object} [options]
 * @param {string} [options.apiKey] 未指定時は process.env.GEMINI_API_KEY を使用
 * @param {string} [options.model] 未指定時は "gemini-2.5-flash"
 * @param {string} [options.responseMimeType] 例: "application/json"。省略時は自由形式(Markdown等)
 * @param {number} [options.temperature]
 * @param {number} [options.maxOutputTokens] 未指定時は 4096
 * @param {number} [options.thinkingBudget] 未指定時は 0 (思考を無効化し、出力の欠落を防ぐ)
 * @param {typeof fetch} [options.fetchImpl] テスト用の差し替え
 * @returns {Promise<string>}
 */
export async function callGemini(prompt, options = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? "gemini-2.5-flash";
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEYが設定されていません");
  }

  const generationConfig = {
    temperature: options.temperature ?? 0.3,
    maxOutputTokens: options.maxOutputTokens ?? 4096,
    thinkingConfig: { thinkingBudget: options.thinkingBudget ?? 0 },
  };
  if (options.responseMimeType) {
    generationConfig.responseMimeType = options.responseMimeType;
  }

  let response;
  try {
    response = await fetchImpl(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
    });
  } catch (error) {
    throw new GeminiError(`Gemini APIへの接続に失敗: ${error.message}`);
  }

  if (!response.ok) {
    throw new GeminiError(`Gemini APIエラー: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    throw new GeminiError(
      finishReason ? `Gemini APIから空の応答 (finishReason: ${finishReason})` : "Gemini APIから空の応答",
    );
  }
  return text;
}
