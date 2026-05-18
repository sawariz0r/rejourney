/**
 * RSS feed for the engineering log — one item per article for discovery and readers.
 */

import { ARTICLES, getAbsoluteArticleImage, getArticlePath } from "~/shared/data/engineering";

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function articlePubDate(urlDate: string): string {
    const d = new Date(`${urlDate}T12:00:00.000Z`);
    return d.toUTCString();
}

export async function loader() {
    const base = "https://rejourney.co";
    const itemsXml = ARTICLES.map((article) => {
        const link = `${base}${getArticlePath(article)}`;
        const image = getAbsoluteArticleImage(article);
        return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${link}</link>
      <description>${escapeXml(article.seo.metaDescription)}</description>
      <author>contact@rejourney.co (${escapeXml(article.author.name)})</author>
      <pubDate>${articlePubDate(article.urlDate)}</pubDate>
      <guid isPermaLink="true">${link}</guid>
      ${article.seo.topicTags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("")}
      <media:content url="${escapeXml(image)}" medium="image" />
      <media:thumbnail url="${escapeXml(image)}" />
    </item>`;
    }).join("");

    const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Rejourney Engineering Log</title>
    <link>${base}/engineering</link>
    <description>Technical articles on mobile session replay, mobile observability, and how Rejourney is built.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />${itemsXml}
  </channel>
</rss>`;

    return new Response(rssFeed, {
        headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
        },
    });
}
