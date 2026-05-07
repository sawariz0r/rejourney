/**
 * Rejourney Dashboard - Landing Page Route
 * 
 * This is the main landing page, server-side rendered for SEO/crawlers.
 */

import React from "react";
import type { Route } from "./+types/route";
import { Hero } from "~/features/public/home/components/Hero";
import { TrustBanners } from "~/features/public/home/components/TrustBanners";
import { Header } from "~/shell/components/layout/Header";
import { Footer } from "~/shell/components/layout/Footer";
import { EngineeringCTA } from "~/features/public/home/components/EngineeringCTA";
import { Features } from "~/features/public/home/components/Features";
import { EmbeddedDemoWindow } from "~/features/public/home/components/EmbeddedDemoWindow";
import { PerformanceMetrics } from "~/features/public/home/components/PerformanceMetrics";

const HOME_DESCRIPTION =
    "Open-source mobile analytics for iOS, Android, Expo, and React Native apps with replay, crashes, heatmaps, journeys, and a light SDK.";

export const meta: Route.MetaFunction = () => [
    { title: "Rejourney: Open Source Mobile Analytics, Session Replay & Observability" },
    {
        name: "description",
        content: HOME_DESCRIPTION,
    },
    {
        name: "keywords",
        content: "open source mobile analytics, mobile session replay, mobile observability, mobile heatmaps, crash reporting, Expo analytics, Swift iOS analytics, self-hosted analytics",
    },
    { property: "og:locale", content: "en_US" },
    { property: "og:title", content: "Rejourney: Open Source Mobile Analytics, Session Replay & Observability" },
    {
        property: "og:description",
        content: "Session replay, heatmaps, crash reporting, journeys, and mobile product analytics in a lightweight open-source SDK.",
    },
    { property: "og:url", content: "https://rejourney.co/" },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "https://rejourney.co/rejourneyIcon-removebg-preview.png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Rejourney: Open Source Mobile Analytics & Session Replay" },
    {
        name: "twitter:description",
        content: "Lightweight open-source mobile observability for iOS, Android, Expo, and React Native apps.",
    },
    { name: "twitter:image", content: "https://rejourney.co/rejourneyIcon-removebg-preview.png" },
    { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    { tagName: "link", rel: "canonical", href: "https://rejourney.co/" },
];

export default function LandingPage() {
    return (
        <div className="public-readable-scope min-h-screen w-full bg-background text-foreground overflow-x-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "WebPage",
                                "@id": "https://rejourney.co/#webpage",
                                url: "https://rejourney.co/",
                                name: "Rejourney: Open Source Mobile Analytics, Session Replay & Observability",
                                description: HOME_DESCRIPTION,
                                inLanguage: "en-US",
                                primaryImageOfPage: {
                                    "@type": "ImageObject",
                                    url: "https://rejourney.co/rejourneyIcon-removebg-preview.png",
                                },
                                isPartOf: {
                                    "@type": "WebSite",
                                    name: "Rejourney",
                                    url: "https://rejourney.co/",
                                },
                                about: [
                                    "mobile analytics",
                                    "session replay",
                                    "mobile observability",
                                    "mobile app analytics",
                                    "crash reporting",
                                    "heatmaps",
                                ],
                            },
                            {
                                "@type": "SoftwareApplication",
                                name: "Rejourney",
                                inLanguage: "en-US",
                                applicationCategory: "DeveloperApplication",
                                operatingSystem: "iOS, Android, React Native, Expo",
                                softwareHelp: "https://rejourney.co/docs/reactnative/overview",
                                codeRepository: "https://github.com/rejourneyco/rejourney",
                                offers: {
                                    "@type": "Offer",
                                    price: "0",
                                    priceCurrency: "USD",
                                },
                                featureList: [
                                    "Mobile session replay",
                                    "Crash reporting",
                                    "Touch heatmaps",
                                    "User journeys",
                                    "Self-hosted deployment",
                                    "React Native, Swift, and Expo SDKs",
                                ],
                            },
                        ],
                    }),
                }}
            />
            <Header />
            <main aria-label="Rejourney - Open Source Mobile App Analytics" className="w-full">
                <Hero />
                <TrustBanners />
                <EmbeddedDemoWindow />
                <Features />
                <PerformanceMetrics />
                <EngineeringCTA />
            </main>
            <Footer />
        </div>
    );
}
