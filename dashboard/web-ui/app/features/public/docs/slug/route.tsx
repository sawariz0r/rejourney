/**
 * Dynamic docs route for markdown-based documentation
 * Handles routes like /docs/contribute, /docs/selfhosted, etc.
 */

import type { Route } from "./+types/route";
import { DocsLayout } from "~/shared/docs/DocsLayout";
import { DocsSidebar } from "~/shared/docs/DocsSidebar";
import { MarkdownContent } from "~/shared/docs/MarkdownContent";
import { getDocMetadata } from "~/shared/lib/docsConfig";

function getSlugFromParams(params: any): string {
    // Route is configured as /docs/* so React Router provides the splat param as "*"
    const raw = (params as any)["*"] || "";
    // Normalize by trimming any leading/trailing slashes
    return String(raw).replace(/^\/+|\/+$/g, "");
}

export const meta: Route.MetaFunction = ({ params, location }) => {
    const slug = getSlugFromParams(params as any);
    const metadata = getDocMetadata(slug);
    const domain = "https://rejourney.co";
    const canonicalUrl = `${domain}${location.pathname}`;

    if (!metadata) {
        return [{ title: "Documentation Not Found - Rejourney" }];
    }

    const title = `${metadata.title} - Rejourney Documentation`;
    const description = metadata.description
        ?? `${metadata.title} documentation for Rejourney's open-source mobile observability platform.`;
    const keywords = metadata.keywords?.join(", ");

    return [
        { title },
        { name: "description", content: description },
        ...(keywords ? [{ name: "keywords", content: keywords }] : []),
        { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
        { tagName: "link", rel: "canonical", href: canonicalUrl },
        // OpenGraph
        { property: "og:locale", content: "en_US" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "Rejourney Documentation" },
        { property: "og:image", content: `${domain}/rejourneyIcon-removebg-preview.png` },
        // Twitter
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: `${domain}/rejourneyIcon-removebg-preview.png` },
    ];
};

export async function loader({ params }: Route.LoaderArgs) {
    const { loadDocContent, getDocMetadata } = await import("~/shared/lib/docsLoader.server");
    const slug = getSlugFromParams(params as any);
    const content = loadDocContent(slug);
    const metadata = getDocMetadata(slug);

    if (!content || !metadata) {
        throw new Response("Documentation not found", { status: 404 });
    }

    return {
        content,
        metadata,
    };
}

export default function DocPage({ loaderData }: Route.ComponentProps) {
    const { content, metadata } = loaderData;

    if (!metadata) {
        return (
            <DocsLayout sidebar={<DocsSidebar />}>
                <div className="text-center py-12">
                    <h1 className="text-2xl font-bold text-black mb-4">Documentation Not Found</h1>
                    <p className="text-gray-600">The requested documentation page could not be found.</p>
                </div>
            </DocsLayout>
        );
    }

    return (
        <DocsLayout
            sidebar={<DocsSidebar />}
        >
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "TechArticle",
                                "headline": metadata.title,
                                "description": metadata.description ?? `${metadata.title} documentation for Rejourney.`,
                                "inLanguage": "en-US",
                                "category": metadata.category,
                                "keywords": metadata.keywords,
                                "mainEntityOfPage": {
                                    "@type": "WebPage",
                                    "@id": `https://rejourney.co/docs/${metadata.path}`
                                },
                                "publisher": {
                                    "@type": "Organization",
                                    "name": "Rejourney",
                                    "inLanguage": "en-US",
                                    "logo": "https://rejourney.co/rejourneyIcon-removebg-preview.png"
                                }
                            },
                            {
                                "@type": "BreadcrumbList",
                                "inLanguage": "en-US",
                                "itemListElement": [
                                    {
                                        "@type": "ListItem",
                                        "position": 1,
                                        "name": "Docs",
                                        "item": "https://rejourney.co/docs/reactnative/overview"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 2,
                                        "name": metadata.title,
                                        "item": `https://rejourney.co/docs/${metadata.path}`
                                    }
                                ]
                            }
                        ]
                    })
                }}
            />
            <header className="mb-12">
                {metadata.category && (
                    <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">
                        {metadata.category}
                    </p>
                )}
                <h1 className="text-3xl font-bold text-black mb-3">
                    {metadata.title}
                </h1>
            </header>

            <MarkdownContent content={content} />
        </DocsLayout>
    );
}
