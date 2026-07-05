import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sources } from "../src/sources/index.js";
import { mergeAndDedupe } from "../src/lib/normalize.js";
import { generateDailySummary } from "../src/lib/summarizer.js";
import { buildReport } from "../src/lib/report-builder.js";

const DATA_DIR = path.resolve("data");
const ARCHIVE_DIR = path.join(DATA_DIR, "archive");
const ARTICLE_LIMIT = 100;

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

  const aiSummary = await generateDailySummary(merged);
  if (!aiSummary.available) {
    console.warn(`[collect] AI要約は生成されませんでした: ${aiSummary.error}`);
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
