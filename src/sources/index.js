import itmedia from "./itmedia.js";
import publickey from "./publickey.js";
import gigazine from "./gigazine.js";

/**
 * 有効化されている情報源の一覧。
 *
 * 新しい情報源を追加する手順:
 *   1. src/sources/xxx.js を作成し、createRssSource(...) をexportする
 *      (base-source.js のJSDocを参照)
 *   2. このファイルでimportし、下の配列に追加する
 *
 * これだけで scripts/collect.js 側のロジックは一切変更不要。
 *
 * @type {import("./base-source.js").NewsSource[]}
 */
export const sources = [itmedia, publickey, gigazine];
