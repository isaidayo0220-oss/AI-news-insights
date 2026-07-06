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
 * 失敗時は必ず GeminiError を投げる（呼び出し元でtry/catchしてフォールバックする想定）。
 *
 * @param {string} prompt
 * @param {Object} [options]
 * @param {string} [options.apiKey] 未指定時は process.env.GEMINI_API_KEY を使用
 * @param {string} [options.model] 未指定時は "gemini-2.5-flash"
 * @param {string} [options.responseMimeType] 例: "application/json"。省略時は自由形式(Markdown等)
 * @param {number} [options.temperature]
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
    throw new GeminiError("Gemini APIから空の応答");
  }
  return text;
}
