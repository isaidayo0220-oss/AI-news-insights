import { callGemini, GeminiError } from "./gemini-client.js";

const ARTICLE_PLACEHOLDER = "{{ARTICLE}}";

/**
 * 1件の記事について、config/deep-dive-prompt.md で定義されたフォーマットに従い
 * Markdown形式の詳細分析を生成する。
 *
 * JSON出力を強制する summarizer.js とは異なり、こちらは自由形式のMarkdown
 * テキストをそのまま返す(見出し・箇条書きなどをフロントで簡易レンダリングする)。
 *
 * @param {import("../sources/base-source.js").NormalizedArticle} article
 * @param {Object} [options]
 * @param {string} options.template 出力フォーマットのテンプレート本文({{ARTICLE}}を含んでもよい)
 * @param {string} [options.apiKey]
 * @param {string} [options.model]
 * @param {typeof fetch} [options.fetchImpl]
 * @returns {Promise<DeepDiveResult>}
 *
 * @typedef {Object} DeepDiveResult
 * @property {boolean} available
 * @property {string} markdown 生成されたMarkdown本文(失敗時は空文字)
 * @property {string} [error]
 */
export async function generateDeepDive(article, options = {}) {
  const template = (options.template ?? "").trim();
  if (!template) {
    return { available: false, markdown: "", error: "出力フォーマットのテンプレートが空です" };
  }

  const articleBlock = [
    `タイトル: ${article.title}`,
    `情報源: ${article.sourceName}`,
    `URL: ${article.url}`,
    `本文抜粋: ${article.excerpt}`,
  ].join("\n");

  const prompt = template.includes(ARTICLE_PLACEHOLDER)
    ? template.replace(ARTICLE_PLACEHOLDER, articleBlock)
    : `${template}\n\n# 記事\n${articleBlock}`;

  try {
    const markdown = await callGemini(prompt, {
      apiKey: options.apiKey,
      model: options.model,
      fetchImpl: options.fetchImpl,
      // Markdown出力を期待するため、JSON形式は強制しない
    });
    return { available: true, markdown: markdown.trim() };
  } catch (error) {
    const message = error instanceof GeminiError ? error.message : `詳細分析の生成に失敗: ${error.message}`;
    return { available: false, markdown: "", error: message };
  }
}
