/**
 * Rejourney Dashboard - Pricing Page Route
 */

import type { Route } from "./+types/route";
import { Header } from "~/shell/components/layout/Header";
import { Footer } from "~/shell/components/layout/Footer";
import { PricingTable } from "~/features/public/home/components/PricingTable";

export const meta: Route.MetaFunction = () => [
    { title: "Rejourney Pricing: Fixed-Price Mobile Analytics & Session Replay" },
    {
        name: "description",
        content: "Transparent fixed pricing for open-source mobile analytics, session replay, heatmaps, crash reporting, and self-hosted Rejourney deployments.",
    },
    {
        name: "keywords",
        content: "mobile analytics pricing, session replay pricing, React Native analytics pricing, PostHog alternative pricing, self-hosted analytics pricing, mobile observability pricing",
    },
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    { property: "og:title", content: "Rejourney Pricing: Fixed-Price Mobile Analytics & Session Replay" },
    {
        property: "og:description",
        content: "Simple fixed pricing for mobile session replay, heatmaps, crash reporting, journeys, and self-hosted analytics.",
    },
    { property: "og:url", content: "https://rejourney.co/pricing" },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://rejourney.co/rejourneyIcon-removebg-preview.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Rejourney Pricing: Fixed-Price Mobile Analytics" },
    {
        name: "twitter:description",
        content: "Fixed pricing for open-source mobile analytics, session replay, heatmaps, and crash reporting.",
    },
    { name: "twitter:image", content: "https://rejourney.co/rejourneyIcon-removebg-preview.png" },
    { tagName: "link", rel: "canonical", href: "https://rejourney.co/pricing" },
];

export default function Pricing() {
    return (
        <div className="min-h-screen w-full bg-white text-black">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "WebPage",
                                "@id": "https://rejourney.co/pricing#webpage",
                                url: "https://rejourney.co/pricing",
                                name: "Rejourney Pricing",
                                description:
                                    "Fixed pricing for mobile analytics, session replay, heatmaps, crash reporting, journeys, and self-hosted deployments.",
                                isPartOf: {
                                    "@type": "WebSite",
                                    name: "Rejourney",
                                    url: "https://rejourney.co/",
                                },
                            },
                            {
                                "@type": "OfferCatalog",
                                name: "Rejourney pricing plans",
                                itemListElement: [
                                    {
                                        "@type": "Offer",
                                        name: "Starter",
                                        price: "5",
                                        priceCurrency: "USD",
                                        url: "https://rejourney.co/pricing",
                                        itemOffered: {
                                            "@type": "SoftwareApplication",
                                            name: "Rejourney Starter",
                                            applicationCategory: "DeveloperApplication",
                                        },
                                    },
                                    {
                                        "@type": "Offer",
                                        name: "Growth",
                                        price: "15",
                                        priceCurrency: "USD",
                                        url: "https://rejourney.co/pricing",
                                        itemOffered: {
                                            "@type": "SoftwareApplication",
                                            name: "Rejourney Growth",
                                            applicationCategory: "DeveloperApplication",
                                        },
                                    },
                                    {
                                        "@type": "Offer",
                                        name: "Pro",
                                        price: "35",
                                        priceCurrency: "USD",
                                        url: "https://rejourney.co/pricing",
                                        itemOffered: {
                                            "@type": "SoftwareApplication",
                                            name: "Rejourney Pro",
                                            applicationCategory: "DeveloperApplication",
                                        },
                                    },
                                ],
                            },
                        ],
                    }),
                }}
            />
            <Header />
            <main aria-label="Pricing" className="w-full">
                <PricingTable />
            </main>
            <Footer />
        </div>
    );
}
