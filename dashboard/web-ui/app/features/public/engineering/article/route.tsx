/**
 * Rejourney Dashboard - Engineering Article Page
 * Renders a specific engineering article based on the route slug.
 */

import type { MetaFunction, LoaderFunctionArgs } from "react-router";
import { Header } from "~/shell/components/layout/Header";
import { Footer } from "~/shell/components/layout/Footer";
import { ARTICLES, getAbsoluteArticleImage, getArticlePath } from "~/shared/data/engineering";
import { ArrowLeft } from "lucide-react";
import { Link, redirect, useLocation, useParams } from "react-router";
import { getContentLocaleCopy, getLocalizedArticleSeo } from "~/shared/lib/contentLocalization";
import {
    getLocalizedAlternateLinksForPath,
    getLocalizedPublicPath,
    getLocalizedPublicUrl,
    getMarketingLocaleFromPathname,
    getMarketingLocaleRedirectPath,
    MARKETING_LOCALE_VARY_HEADER,
} from "~/shared/lib/internationalMarketing";

const SITE_URL = "https://rejourney.co";

function getArticleUrl(article: (typeof ARTICLES)[number], locale = getMarketingLocaleFromPathname("/")): string {
    return getLocalizedPublicUrl(locale, getArticlePath(article));
}

// Loader to validate slug
export function loader({ params, request }: LoaderFunctionArgs) {
    const article = ARTICLES.find((a) => a.id === params.slug);
    if (!article) {
        throw new Response("Article not found", { status: 404 });
    }

    const requestUrl = new URL(request.url);
    const localeRedirectPath = getMarketingLocaleRedirectPath(request);
    if (localeRedirectPath) {
        const preferredLocale = getMarketingLocaleFromPathname(localeRedirectPath);
        throw redirect(`${getLocalizedPublicPath(preferredLocale, getArticlePath(article))}${requestUrl.search}`, {
            status: params.date !== article.urlDate ? 301 : 302,
            headers: {
                Vary: MARKETING_LOCALE_VARY_HEADER,
            },
        });
    }

    if (params.date !== article.urlDate) {
        const locale = getMarketingLocaleFromPathname(requestUrl.pathname);
        throw redirect(`${getLocalizedPublicPath(locale, getArticlePath(article))}${requestUrl.search}`, { status: 301 });
    }

    return null;
}

export const meta: MetaFunction = ({ params, location }) => {
    const article = ARTICLES.find((a) => a.id === params.slug);
    const locale = getMarketingLocaleFromPathname(location.pathname);
    const copy = getContentLocaleCopy(locale);
    if (!article) {
        return [{ title: "Article Not Found - Rejourney" }];
    }
    const localizedArticle = getLocalizedArticleSeo(article, locale);
    const canonicalPath = getArticlePath(article);
    const canonicalUrl = getArticleUrl(article, locale);
    const imageUrl = getAbsoluteArticleImage(article);
    const imageAlt = article.imageAlt ?? localizedArticle.title;
    const metaTitle = localizedArticle.metaTitle;
    const metaDescription = localizedArticle.metaDescription;
    const publishedTime = `${article.urlDate}T12:00:00.000Z`;
    const modifiedTime = `${article.dateModified ?? article.urlDate}T12:00:00.000Z`;
    const alternateLinks = getLocalizedAlternateLinksForPath(canonicalPath).map((alternate) => ({
        tagName: "link",
        rel: "alternate",
        hrefLang: alternate.hrefLang,
        href: alternate.href,
    }));
    const alternateOgLocales = getLocalizedAlternateLinksForPath(canonicalPath)
        .filter((alternate) => alternate.hrefLang !== "x-default" && alternate.hrefLang !== locale.languageTag)
        .map((alternate) => ({
            property: "og:locale:alternate",
            content: getMarketingLocaleFromPathname(new URL(alternate.href).pathname).ogLocale,
        }));
    const metaTags = [
        { title: `${metaTitle} | ${copy.articleMetaTitleSuffix}` },
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
        { name: "description", content: metaDescription },
        { name: "keywords", content: localizedArticle.targetKeywords.join(", ") },
        { name: "news_keywords", content: article.seo.topicTags.join(", ") },
        { name: "author", content: article.author.name },
        { httpEquiv: "Content-Language", content: locale.languageTag },
        { property: "og:locale", content: locale.ogLocale },
        ...alternateOgLocales,
        { property: "og:title", content: metaTitle },
        { property: "og:description", content: metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: imageUrl },
        { property: "og:image:secure_url", content: imageUrl },
        { property: "og:image:alt", content: imageAlt },
        { property: "og:site_name", content: "Rejourney" },
        { property: "og:updated_time", content: modifiedTime },
        { property: "article:published_time", content: publishedTime },
        { property: "article:modified_time", content: modifiedTime },
        { property: "article:section", content: "Engineering" },
        { property: "article:author", content: article.author.name },
        ...article.seo.topicTags.map((tag) => ({ property: "article:tag", content: tag })),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: metaTitle },
        { name: "twitter:description", content: metaDescription },
        { name: "twitter:image", content: imageUrl },
        { name: "twitter:image:alt", content: imageAlt },
        { name: "twitter:label1", content: "Written by" },
        { name: "twitter:data1", content: article.author.name },
        { name: "twitter:label2", content: "Read time" },
        { name: "twitter:data2", content: localizedArticle.readTime },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        ...alternateLinks,
    ];
    return metaTags;
};

export default function EngineeringArticlePage() {
    const { slug } = useParams();
    const location = useLocation();
    const locale = getMarketingLocaleFromPathname(location.pathname);
    const copy = getContentLocaleCopy(locale);
    const article = ARTICLES.find((a) => a.id === slug);

    if (!article) {
        return <div>{copy.documentationNotFoundHeading}</div>;
    }

    const canonicalUrl = getArticleUrl(article, locale);
    const localizedArticle = getLocalizedArticleSeo(article, locale);
    const imageUrl = getAbsoluteArticleImage(article);
    const imageAlt = article.imageAlt ?? localizedArticle.title;
    const sameAs = [article.author.url, article.author.github].filter(Boolean);
    const articleStructuredData = {
        ...article.schema,
        "@context": "https://schema.org",
        headline: localizedArticle.title,
        description: localizedArticle.metaDescription,
        inLanguage: locale.languageTag,
        url: canonicalUrl,
        datePublished: article.urlDate,
        keywords: localizedArticle.targetKeywords,
        dateModified: article.dateModified ?? article.urlDate,
        image: [{
            "@type": "ImageObject",
            url: imageUrl,
            caption: imageAlt,
        }],
        thumbnailUrl: imageUrl,
        articleSection: "Engineering",
        ...(article.wordCount ? { wordCount: article.wordCount } : {}),
        ...(article.timeRequired ? { timeRequired: article.timeRequired } : {}),
        author: {
            "@type": "Person",
            name: article.author.name,
            url: article.author.url,
            ...(sameAs.length ? { sameAs } : {}),
        },
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": canonicalUrl,
        },
        isPartOf: {
            "@type": "WebSite",
            name: "Rejourney",
            url: SITE_URL,
        },
        about: article.seo.topicTags.map((tag) => ({
            "@type": "Thing",
            name: tag,
        })),
        publisher: {
            "@type": "Organization",
            name: "Rejourney",
            logo: {
                "@type": "ImageObject",
                url: `${SITE_URL}/rejourneyIcon-removebg-preview.png`,
            },
        },
    };

    return (
        <div className="public-readable-scope min-h-screen w-full bg-white text-slate-900 font-sans selection:bg-yellow-200 flex flex-col" lang={locale.languageTag} dir={locale.dir}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(articleStructuredData),
                }}
            />
            <Header />

            <main className="flex-grow w-full">
                {/* Progress Bar (Conceptual - sticky top) */}
                <div className="sticky top-0 left-0 w-full h-1 bg-gray-100 z-50">
                    <div className="h-full bg-black w-full origin-left scale-x-0 animate-scroll-progress" />
                </div>

                <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">

                    <Link to={getLocalizedPublicPath(locale, "/engineering")} className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-black mb-12 transition-colors">
                        <ArrowLeft size={16} /> {copy.backToEngineering}
                    </Link>

                    <article className="mx-auto max-w-4xl">
                        <header className="mb-16 border-b-4 border-black pb-12">
                            <div className="flex flex-wrap items-center gap-4 text-xs font-mono font-black uppercase tracking-widest text-blue-600 mb-6">
                                <span>{article.date}</span>
                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                <span>{localizedArticle.readTime}</span>
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black uppercase tracking-tighter mb-8 leading-[0.9]">
                                {localizedArticle.title}
                            </h1>

                            <p className="text-xl sm:text-2xl font-medium text-gray-600 max-w-3xl leading-relaxed">
                                {localizedArticle.subtitle}
                            </p>

                            <div className="flex items-center gap-3 mt-8">
                                <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center font-bold text-gray-500">
                                    {article.author.name.charAt(0)}
                                </div>
                                <div className="text-sm">
                                    <div className="font-bold text-gray-900">{article.author.name}</div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                        <a href={article.author.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                            {copy.viewLinkedIn}
                                        </a>
                                        {article.author.github && (
                                            <a href={article.author.github} target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:underline">
                                                {copy.viewGitHub}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </header>

                    </article>

                    <div className={article.tableOfContents?.length ? "mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_16rem]" : "mx-auto max-w-4xl"}>
                        <div className={article.kind === "markdown" ? "max-w-4xl space-y-8" : "prose prose-xl prose-slate max-w-4xl prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-img:rounded-none prose-img:border-2 prose-img:border-black"}>
                            {article.content}
                        </div>

                        {article.tableOfContents?.length ? (
                            <aside className="hidden lg:block">
                                <nav className="sticky top-24 border-l border-slate-200 pl-5" aria-label={copy.articleOnThisPage}>
                                    <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">{copy.articleOnThisPage}</p>
                                    <ol className="space-y-3">
                                        {article.tableOfContents.map((item) => (
                                            <li key={item.id} className={item.level === 3 ? "pl-4" : undefined}>
                                                <a href={`#${item.id}`} className="block text-sm font-semibold leading-snug text-slate-600 transition hover:text-slate-950">
                                                    {item.title}
                                                </a>
                                            </li>
                                        ))}
                                    </ol>
                                </nav>
                            </aside>
                        ) : null}
                    </div>

                    <article className="mx-auto max-w-4xl">
                        <div className="mt-20 pt-12 border-t-2 border-gray-100">
                            <h3 className="text-2xl font-black uppercase tracking-tighter mb-8">{copy.authorHeading}</h3>
                            <div className="flex items-start gap-4">
                                <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center font-bold text-2xl text-gray-500">
                                    {article.author.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-xl text-gray-900 mb-1">{article.author.name}</div>
                                    <p className="text-gray-500 text-sm mb-2">{copy.engineeringTeamLabel}</p>
                                    <div className="flex gap-4">
                                        <a href={article.author.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline">
                                            {copy.viewLinkedIn}
                                        </a>
                                        {article.author.github && (
                                            <a href={article.author.github} target="_blank" rel="noopener noreferrer" className="text-gray-900 font-bold hover:underline">
                                                {copy.viewGitHub}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>

                </div>
            </main>
            <Footer />
        </div>
    );
}
