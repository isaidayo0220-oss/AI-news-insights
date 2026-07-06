const DATA_URL = "data/latest.json";

const el = {
  mastheadMeta: document.getElementById("masthead-meta"),
  summaryPanel: document.getElementById("summary-panel"),
  highlights: document.getElementById("highlights"),
  highlightsList: document.getElementById("highlights-list"),
  sourceFilter: document.getElementById("source-filter"),
  articleList: document.getElementById("article-list"),
};

init();

async function init() {
  try {
    const report = await loadReport();
    renderMasthead(report);
    renderSummary(report.aiSummary);
    renderHighlights(report.aiSummary, report.articles);
    renderArticles(report);
  } catch (error) {
    console.error(error);
    renderLoadError();
  }
}

async function loadReport() {
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`data/latest.json の取得に失敗しました (HTTP ${res.status})`);
  }
  return res.json();
}

function renderMasthead(report) {
  const generated = formatDateTime(report.generatedAt);
  const sourceNames = report.sources.map((s) => s.name).join(" / ");
  el.mastheadMeta.innerHTML =
    `最終同期 <span class="dot">●</span> ${generated}　·　` +
    `${report.articleCount}件収載　·　情報源: ${escapeHtml(sourceNames)}`;
}

function renderSummary(aiSummary) {
  if (!aiSummary?.available) {
    el.summaryPanel.innerHTML = `<p class="summary-panel__error">本日のAI要約は生成されていません${
      aiSummary?.error ? `（${escapeHtml(aiSummary.error)}）` : ""
    }。記事一覧は下部でご覧いただけます。</p>`;
    return;
  }
  el.summaryPanel.innerHTML = `<p class="summary-panel__overview">${escapeHtml(aiSummary.overview)}</p>`;
}

function renderHighlights(aiSummary, articles) {
  if (!aiSummary?.available || !aiSummary.highlights?.length) {
    el.highlights.hidden = true;
    return;
  }

  const articleMap = new Map(articles.map((a) => [a.id, a]));
  el.highlightsList.innerHTML = aiSummary.highlights
    .map((h, i) => {
      const article = articleMap.get(h.articleId);
      const url = article?.url ?? "#";
      const title = h.title || article?.title || "(タイトル不明)";
      const analysis = h.analysisMarkdown
        ? `
        <details class="highlight-card__details">
          <summary>詳細分析を見る</summary>
          <div class="highlight-card__analysis">${renderMarkdownLite(h.analysisMarkdown)}</div>
        </details>`
        : "";
      return `
        <li class="highlight-card" data-rank="${i + 1}">
          <p class="highlight-card__title"><a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a></p>
          <p class="highlight-card__reason">${escapeHtml(h.reason)}</p>
          ${analysis}
        </li>`;
    })
    .join("");
  el.highlights.hidden = false;
}

/**
 * Gemini出力のMarkdown(見出し/箇条書き/太字/水平線程度)を安全なHTMLに変換する軽量レンダラー。
 * 外部ライブラリに依存せず、まずHTMLエスケープしてからMarkdown記法のみをタグに変換するため、
 * AIが出力したテキストに万一HTMLが含まれていても、そのまま埋め込まれることはない。
 */
function renderMarkdownLite(markdown) {
  const lines = escapeHtml(markdown).split("\n");
  const htmlParts = [];
  let listBuffer = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      htmlParts.push(`<ul>${listBuffer.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      listBuffer = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const inline = (text) => text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    if (line === "" || line === "---") {
      flushList();
      if (line === "---") htmlParts.push("<hr>");
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      htmlParts.push(`<h5>${inline(line.slice(4))}</h5>`);
    } else if (line.startsWith("## ")) {
      flushList();
      htmlParts.push(`<h4>${inline(line.slice(3))}</h4>`);
    } else if (line.startsWith("* ") || line.startsWith("- ")) {
      listBuffer.push(inline(line.slice(2)));
    } else {
      flushList();
      htmlParts.push(`<p>${inline(line)}</p>`);
    }
  }
  flushList();
  return htmlParts.join("");
}

function renderArticles(report) {
  const { articles, sources } = report;

  renderFilterChips(sources);

  el.articleList.innerHTML = articles
    .map(
      (a) => `
      <li class="article-row" data-source="${escapeAttr(a.sourceId)}">
        <div class="article-row__time">
          <time datetime="${escapeAttr(a.publishedAt)}">${formatDateShort(a.publishedAt)}</time>
          <span class="article-row__source">${escapeHtml(a.sourceName)}</span>
        </div>
        <div>
          <p class="article-row__title"><a href="${escapeAttr(a.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a></p>
          <p class="article-row__excerpt">${escapeHtml(a.excerpt)}</p>
        </div>
      </li>`,
    )
    .join("");
}

function renderFilterChips(sources) {
  const extraChips = sources
    .map((s) => `<button class="chip" data-source="${escapeAttr(s.id)}" role="tab" aria-selected="false">${escapeHtml(s.name)}</button>`)
    .join("");
  el.sourceFilter.insertAdjacentHTML("beforeend", extraChips);

  el.sourceFilter.addEventListener("click", (event) => {
    const btn = event.target.closest(".chip");
    if (!btn) return;
    applyFilter(btn.dataset.source);

    el.sourceFilter.querySelectorAll(".chip").forEach((c) => {
      const active = c === btn;
      c.classList.toggle("chip--active", active);
      c.setAttribute("aria-selected", String(active));
    });
  });
}

function applyFilter(sourceId) {
  el.articleList.querySelectorAll(".article-row").forEach((row) => {
    const show = sourceId === "all" || row.dataset.source === sourceId;
    row.hidden = !show;
  });
}

function renderLoadError() {
  el.mastheadMeta.textContent = "同期に失敗しました";
  el.summaryPanel.innerHTML =
    '<p class="summary-panel__error">data/latest.json を読み込めませんでした。GitHub Actionsによる初回収集が完了しているかご確認ください。</p>';
}

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ja-JP", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str = "") {
  return escapeHtml(str);
}
