import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { sources } from "../src/sources/index.js";
import { mergeAndDedupe } from "../src/lib/normalize.js";
import { generateDailySummary } from "../src/lib/summarizer.js";
import { generateDeepDive } from "../src/lib/deep-dive.js";
import { buildReport } from "../src/lib/report-builder.js";

const DATA_DIR = path.resolve("data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");
const POLICY_FILE = path.resolve("config/prompt.md");
const DEEP_DIVE_TEMPLATE_FILE = path.resolve("config/deep-dive-prompt.md");
const ARTICLE_LIMIT = 100;

/**
 * markdownファイルから指定マーカーで囲まれた本文だけを取り出す。
 * ファイルが無い/マーカーが見つからない場合は空文字を返し、
 * 呼び出し元のデフォルト値にフォールバックする(壊れても収集全体を止めない)。
 *
 * @param {string} filePath
 * @param {string} startMarker 例: "<!-- POLICY:START -->"
 * @param {string} endMarker 例: "<!-- POLICY:END -->"
 */
async function loadMarkedSection(filePath, startMarker, endMarker) {
  try {
    const raw = await readFile(filePath, "utf-8");
    const start = raw.indexOf(startMarker);
    const end = raw.indexOf(endMarker);
    if (start === -1 || end === -1 || end <= start) return "";
    return raw.slice(start + startMarker.length, end).trim();
  } catch {
    console.warn(`[collect] ${filePath} が見つからないため、デフォルト値を使用します`);
    return "";
  }
}

async function main() {
  console.log(`[collect] ${sources.length}件の情報源から収集を開始します`);

  const results = await Promise.allSettled(sources.map((s) => s.fetchItems()));

  const articles = [];
  results.forEach((result, i) => {
    const source = sources[i];
    if (result.status === "fulfilled") {
      console.log(`[collect] ${source.name}: ${result.value.length}件`);
      articles.push(...result.value);
    } else {
      console.error(`[collect] ${source.name}: 収集失敗 - ${result.reason?.message ?? result.reason}`);
    }
  });

  const merged = mergeAndDedupe(articles, { limit: ARTICLE_LIMIT });
  console.log(`[collect] 重複排除後: ${merged.length}件`);

  const customInstructions = await loadMarkedSection(
    POLICY_FILE,
    "<!-- POLICY:START -->",
    "<!-- POLICY:END -->",
  );
  const aiSummary = await generateDailySummary(merged, { customInstructions });
  if (!aiSummary.available) {
    console.warn(`[collect] AI要約は生成されませんでした: ${aiSummary.error}`);
  }

  // 注目記事Top5それぞれについて、詳細分析(deep dive)を生成する。
  // 全記事に対して行うと呼び出し回数が増えすぎるため、注目記事のみに絞る。
  if (aiSummary.available && aiSummary.highlights.length > 0) {
    const template = await loadMarkedSection(
      DEEP_DIVE_TEMPLATE_FILE,
      "<!-- TEMPLATE:START -->",
      "<!-- TEMPLATE:END -->",
    );
    const articleMap = new Map(merged.map((a) => [a.id, a]));

    for (const highlight of aiSummary.highlights) {
      const article = articleMap.get(highlight.articleId);
      if (!article) continue;

      const deepDive = await generateDeepDive(article, { template });
      if (deepDive.available) {
        highlight.analysisMarkdown = deepDive.markdown;
      } else {
        console.warn(`[collect] 詳細分析生成に失敗 (${article.id}): ${deepDive.error}`);
      }
    }
  }

  const report = buildReport({ articles: merged, aiSummary, sources });

  await mkdir(ARCHIVE_DIR, { recursive: true });
  const dateStr = report.generatedAt.slice(0, 10); // YYYY-MM-DD

  await writeFile(path.join(DATA_DIR, "latest.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(ARCHIVE_DIR, `${dateStr}.json`), JSON.stringify(report, null, 2));

  console.log(`[collect] data/latest.json と data/archive/${dateStr}.json を出力しました`);
}

main().catch((error) => {
  console.error("[collect] 致命的エラー:", error);
  process.exitCode = 1;
});
