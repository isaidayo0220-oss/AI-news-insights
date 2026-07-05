import { createRssSource } from "./base-source.js";

export default createRssSource({
  id: "itmedia",
  name: "ITmedia NEWS",
  feedUrl: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml",
  homepage: "https://www.itmedia.co.jp/news/",
});
