/**
 * Dynamic sitemap.xml route
 * Generates an up-to-date sitemap including all documentation pages
 */

import { DOCS_MAP } from "~/shared/lib/docsConfig";
import { ARTICLES } from "~/shared/data/engineering";
import {
    MARKETING_LOCALE_ORDER,
    MARKETING_LOCALES,
    getMarketingAlternateLinks,
} from "~/shared/lib/internationalMarketing";

function escapeXml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

interface SitemapRoute {
    path: string;
    priority: string;
    changefreq: string;
    lastmod?: string;
    image?: string;
    imageTitle?: string;
    alternates?: ReturnType<typeof getMarketingAlternateLinks>;
}

export async function loader() {
    const baseUrl = "https://rejourney.co";
    const lastModified = new Date().toISOString().slice(0, 10);

    const marketingRoutes: SitemapRoute[] = MARKETING_LOCALE_ORDER.map((code) => ({
        path: MARKETING_LOCALES[code].path,
        priority: code === "en" ? "1.0" : "0.8",
        changefreq: "daily",
        alternates: getMarketingAlternateLinks(),
    }));

    const staticRoutes: SitemapRoute[] = [
        { path: "/dashboard", priority: "0.9", changefreq: "daily" },
        { path: "/pricing", priority: "0.8", changefreq: "weekly" },
        { path: "/engineering", priority: "0.9", changefreq: "weekly" },
        { path: "/changelog", priority: "0.8", changefreq: "weekly" },
    ];

    const docRoutes: SitemapRoute[] = Object.keys(DOCS_MAP).map(slug => ({
        path: `/docs/${slug}`,
        priority: slug === "reactnative/overview" ? "0.9" : "0.7",
        changefreq: "weekly"
    }));

    const engineeringRoutes: SitemapRoute[] = ARTICLES.map(article => ({
        path: `/engineering/${article.urlDate}/${article.id}`,
        priority: "0.8",
        changefreq: "monthly",
        lastmod: article.dateModified ?? article.urlDate,
        image: article.image,
        imageTitle: article.title,
    }));

    // Generate XML content
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...marketingRoutes, ...staticRoutes, ...docRoutes, ...engineeringRoutes].map(route => `
  <url>
    <loc>${escapeXml(`${baseUrl}${route.path}`)}</loc>
    <lastmod>${"lastmod" in route && route.lastmod ? route.lastmod : lastModified}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
    ${route.alternates ? route.alternates.map((alternate) => `<xhtml:link rel="alternate" hreflang="${escapeXml(alternate.hrefLang)}" href="${escapeXml(alternate.href)}" />`).join("\n    ") : ""}
    ${route.image && route.imageTitle ? `<image:image>
      <image:loc>${escapeXml(route.image)}</image:loc>
      <image:title>${escapeXml(route.imageTitle)}</image:title>
    </image:image>` : ""}
  </url>`).join('')}
</urlset>`.trim();

    return new Response(sitemap, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, max-age=3600, s-maxage=18000"
        },
    });
}
