# Wire Desk — AIニュース収集・分析ブリーフィング

RSS/公式APIからニュースを収集し、AI（Google Gemini）が日次で要約・注目記事を選定する、
完全無料運用が可能な情報収集・分析ツールです。

**デモ**: `https://<username>.github.io/<repo>/`（GitHub Pages設定後に有効）

---

## コンセプト

- 情報源は **RSS/公式APIのみ**を利用し、HTMLスクレイピングは行いません（利用規約・robots.txt遵守）。
- 新しい情報源は **プラグイン形式**で追加でき、既存コードの変更は最小限で済みます。
- AI要約には無料枠のある **Google Gemini API (gemini-1.5-flash)** を使用し、運用コストを実質ゼロに抑えています。
- サーバーは持たず、**GitHub Actions + GitHub Pages** のみで完結します。

## アーキテクチャ

```
┌─────────────────────────────┐
│ GitHub Actions (毎日 06:00 JST cron)│
│                                       │
│  sources/*.js (プラグイン)            │
│      ↓ RSS/Atom取得                   │
│  lib/normalize.js                     │
│      ↓ 重複排除・ソート                │
│  lib/summarizer.js                    │
│      ↓ Gemini APIで要約 (Secrets)      │
│  lib/report-builder.js                │
│      ↓ JSON生成                        │
│  data/latest.json / data/archive/*.json│
│      ↓ git commit & push               │
└─────────────────────────────┘
                 ↓
┌─────────────────────────────┐
│ GitHub Pages (静的フロントエンド)      │
│  index.html + css/ + js/app.js         │
│  → data/latest.json を fetch して描画  │
└─────────────────────────────┘
```

この構成により、**APIキーはActions実行環境にのみ存在**し、公開されるフロントエンドに
一切露出しません。またブラウザから外部サイトへ直接アクセスしないため、CORSの問題も発生しません。

## ディレクトリ構成

```
.
├── index.html              # フロントエンド エントリポイント
├── css/style.css            # スタイル
├── js/app.js                 # data/latest.json を描画するロジック
├── src/
│   ├── sources/              # 情報源プラグイン群
│   │   ├── base-source.js    # 共通インターフェース(factory)
│   │   ├── index.js          # 有効な情報源の一覧レジストリ
│   │   ├── itmedia.js        # ITmedia NEWS (RSS)
│   │   ├── publickey.js      # Publickey (Atom)
│   │   └── gigazine.js       # GIGAZINE (RSS)
│   └── lib/
│       ├── rss-parser.js     # フィード取得ラッパー
│       ├── normalize.js      # 重複排除・ソート(純粋関数)
│       ├── summarizer.js     # Gemini APIによるAI要約
│       └── report-builder.js # 最終JSONレポートの組み立て
├── scripts/collect.js         # バッチ処理のエントリポイント(Actionsから実行)
├── data/
│   ├── latest.json            # 最新レポート(フロントが参照)
│   └── archive/YYYY-MM-DD.json # 日次アーカイブ
├── tests/                     # Vitestによるユニットテスト
└── .github/workflows/
    ├── collect.yml             # 日次収集バッチ
    └── ci.yml                  # lint + test
```

## セットアップ手順

### 1. リポジトリを作成してこのコードをpush

```bash
git init
git add .
git commit -m "chore: initial commit"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

### 2. Gemini APIキーを取得する

1. [Google AI Studio](https://aistudio.google.com/) にアクセスし、Googleアカウントでログイン
2. 「Get API key」からAPIキーを発行（無料枠あり）

### 3. GitHub SecretsにAPIキーを登録

リポジトリの `Settings > Secrets and variables > Actions > New repository secret` から:

- Name: `GEMINI_API_KEY`
- Value: 取得したAPIキー

### 4. GitHub Pagesを有効化

`Settings > Pages` で `Deploy from a branch` を選択し、ブランチ `main` / フォルダ `/ (root)` を指定します。

### 5. 初回収集を手動実行

`Actions` タブ → `Collect news and update report` → `Run workflow` を手動実行すると、
`data/latest.json` が実データで更新されます（以降は毎日自動実行されます）。

## 情報源の追加方法（プラグイン拡張）

新しいRSS/Atom情報源を追加する場合、既存コードの変更は不要です。

1. `src/sources/` に新しいファイルを作成:

   ```js
   // src/sources/example.js
   import { createRssSource } from "./base-source.js";

   export default createRssSource({
     id: "example",
     name: "Example News",
     feedUrl: "https://example.com/rss.xml",
     homepage: "https://example.com/",
   });
   ```

2. `src/sources/index.js` に1行追加:

   ```js
   import example from "./example.js";
   export const sources = [itmedia, publickey, gigazine, example];
   ```

これだけで収集・重複排除・AI要約・フロントエンドの絞り込みタブすべてに自動的に反映されます。

RSS以外の情報源（公式REST APIなど）を追加したい場合は、`base-source.js` の
`NewsSource` インターフェース（`id` / `name` / `homepage` / `fetchItems()`）を満たす
オブジェクトを独自に実装し、同様に `index.js` へ登録してください。

## 開発

```bash
npm install
npm test          # ユニットテスト
npm run lint       # ESLint
npm run collect    # ローカルでの収集実行 (.env に GEMINI_API_KEY が必要)
```

ローカルでフロントエンドを確認する場合は、任意の静的サーバーで配信してください。

```bash
npx http-server . -p 8080
```

## 利用規約・robots.txt遵守について

- 収集は各サイトが自ら公開している **公式RSS/Atomフィード**のみを対象とし、
  HTMLページへのスクレイピングは行いません。
- 取得時はUser-Agentを明示し、収集主体を隠しません（`src/lib/rss-parser.js`）。
- 各記事へのリンクは必ず一次情報源へ直接遷移する形とし、本文の複製・転載は行いません
  （表示するのはタイトル・抜粋・AIによる要約のみです）。
- 新しい情報源を追加する際は、その情報源の利用規約・robots.txtを個別に確認してください。

## 今後の拡張候補

- ニュースからのTODO/アクション提案生成（第2弾MVP）
- カテゴリ別（ビジネス/経済など）情報源プラグインの追加
- 週次/月次のトレンド分析レポート
- 通知連携（Slack/メールへの日次ダイジェスト配信）

## ライセンス

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。
