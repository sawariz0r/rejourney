/**
 * Rejourney Dashboard - Engineering Page Index
 * Displays the list of available engineering articles.
 */

import type { MetaFunction } from "react-router";
import { Header } from "~/shell/components/layout/Header";
import { Footer } from "~/shell/components/layout/Footer";
import { ARTICLES } from "~/shared/data/engineering";
import { Link } from "react-router";

const ENGINEERING_LOG_URL = "https://rejourney.co/engineering";
const SITE_URL = "https://rejourney.co";
const ENGINEERING_KEYWORDS = Array.from(
    new Set(ARTICLES.flatMap((article) => article.seo.targetKeywords))
).join(", ");
const ARTICLE_IMAGES: Record<string, string> = {
    "mobile-session-replay-cost": "/images/session-replay-preview.png",
    "swift-package-open-beta": "/images/hero-replay-workbench.png",
    "rejourney-1-3-million-session-replays": "/images/engineering/k3s-cloud-setup.svg",
    "maps-performance": "/images/geo-intelligence.png",
    "architecture-deep-dive": "/images/engineering/session-lifecycle.svg",
};

function getArticleImage(article: (typeof ARTICLES)[number]): string {
    return ARTICLE_IMAGES[article.id] ?? article.image;
}

function getArticleImageUrl(article: (typeof ARTICLES)[number]): string {
    const image = getArticleImage(article);
    return image.startsWith("/") ? `${SITE_URL}${image}` : image;
}

export const meta: MetaFunction = () => [
    { title: "Engineering Log — Technical articles | Rejourney" },
    {
        name: "description",
        content:
            "Technical articles on mobile session replay, map capture, GPU replay architecture, and lightweight mobile observability.",
    },
    {
        name: "keywords",
        content: ENGINEERING_KEYWORDS,
    },
    { name: "robots", content: "index, follow" },
    { property: "og:locale", content: "en_US" },
    { property: "og:title", content: "Rejourney Engineering Log" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: ENGINEERING_LOG_URL },
    {
        property: "og:description",
        content:
            "Technical articles on session replay, native map capture at 120Hz, and how we built lightweight mobile observability.",
    },
    { tagName: "link", rel: "canonical", href: ENGINEERING_LOG_URL },
];

export default function EngineeringIndexPage() {
    return (
        <div className="public-readable-scope min-h-screen w-full bg-white text-slate-950 font-sans selection:bg-sky-100 selection:text-slate-950 flex flex-col">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "CollectionPage",
                                "@id": `${ENGINEERING_LOG_URL}#webpage`,
                                url: ENGINEERING_LOG_URL,
                                name: "Rejourney Engineering Log",
                                inLanguage: "en-US",
                                description:
                                    "Technical articles from the Rejourney team on mobile session replay, map SDK capture, and observability architecture.",
                                isPartOf: {
                                    "@type": "WebSite",
                                    name: "Rejourney",
                                    url: "https://rejourney.co/",
                                },
                                mainEntity: { "@id": `${ENGINEERING_LOG_URL}#posts` },
                            },
                            {
                                "@type": "ItemList",
                                "@id": `${ENGINEERING_LOG_URL}#posts`,
                                name: "Engineering log articles",
                                inLanguage: "en-US",
                                numberOfItems: ARTICLES.length,
                                itemListElement: ARTICLES.map((article, index) => ({
                                    "@type": "ListItem",
                                    position: index + 1,
                                    url: `${ENGINEERING_LOG_URL}/${article.urlDate}/${article.id}`,
                                    name: article.title,
                                    description: article.seo.metaDescription,
                                    image: getArticleImageUrl(article),
                                    keywords: article.seo.targetKeywords,
                                })),
                            },
                        ],
                    }),
                }}
            />
            <Header />

            <main className="w-full flex-grow">
                <section className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:px-10 lg:pb-24">
                    <div className="mb-12 sm:mb-14">
                        <p className="text-base font-semibold text-slate-500">From the dev team</p>
                        <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-none tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
                            Engineering
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                            Friendly technical notes from the Rejourney team on mobile replay, SDK architecture, map capture, infrastructure, and performance.
                        </p>
                    </div>

                    <div className="grid gap-x-10 gap-y-16 md:grid-cols-2 xl:grid-cols-3">
                        {ARTICLES.map((article, index) => (
                            <Link
                                to={`/engineering/${article.urlDate}/${article.id}`}
                                key={article.id}
                                aria-label={`Read ${article.title}`}
                                className={index < 2 ? "group block md:col-span-1" : "group block"}
                            >
                                <div className="aspect-[1.9/1] overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm">
                                    <img
                                        src={getArticleImage(article)}
                                        alt=""
                                        className="h-full w-full object-cover brightness-[0.96] saturate-[0.95] transition duration-300 group-hover:scale-[1.015] group-hover:brightness-100 group-hover:saturate-100"
                                        loading={index < 2 ? "eager" : "lazy"}
                                    />
                                </div>
                                <p className="mt-5 text-base font-semibold text-slate-500">
                                    {article.date} <span className="px-1.5 text-slate-300">·</span> {article.readTime}
                                </p>
                                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-normal text-slate-950 transition group-hover:text-sky-700 sm:text-3xl">
                                    {article.title}
                                </h2>
                                <p className="mt-3 text-lg leading-relaxed text-slate-600">
                                    {article.subtitle}
                                </p>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
