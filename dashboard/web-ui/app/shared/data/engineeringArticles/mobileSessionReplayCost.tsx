import { Cpu, Database, Server, Shield, TrendingDown } from "lucide-react";
import type { Article } from "../engineeringTypes";

// --- Content: 17× Cheaper Pricing Breakdown ---

const PRICING_ARTICLE_URL = "https://rejourney.co/engineering/2026-05-06/mobile-session-replay-cost";

const pricingArticleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "17× Cheaper Than PostHog Session Replay",
    description:
        "The pricing math comparing Rejourney to PostHog, and the engineering decisions — lean native SDK, Redis-buffered uploads, Hetzner k3s HA infra — that keep Rejourney fixed-price at any session volume.",
    url: PRICING_ARTICLE_URL,
    keywords: [
        "session replay pricing",
        "react native session replay cost",
        "mobile observability cost",
        "GDPR session replay",
        "EU mobile analytics",
        "affordable session replay",
        "mobile crash reporting pricing",
        "session recording pricing comparison",
        "fixed price session replay",
        "mobile observability budget",
    ],
    author: {
        "@type": "Person",
        name: "Mohammad Rashid",
        url: "https://www.linkedin.com/in/mohammad-rashid7337/",
        github: "https://github.com/Mohammad-R-Rashid",
    },
    datePublished: "2026-05-06",
    dateModified: "2026-05-06",
    publisher: {
        "@type": "Organization",
        name: "Rejourney",
        logo: {
            "@type": "ImageObject",
            url: "https://rejourney.co/rejourneyIcon-removebg-preview.png",
        },
    },
    mainEntityOfPage: {
        "@type": "WebPage",
        "@id": PRICING_ARTICLE_URL,
    },
};

const PLAN_DATA = [
    { plan: "Starter", sessionsLabel: "25,000", sessions: 25_000, subCost: 5, usageCost: 85.0, multiplier: 17.0 },
    { plan: "Growth", sessionsLabel: "100,000", sessions: 100_000, subCost: 15, usageCost: 272.5, multiplier: 18.2 },
    { plan: "Pro", sessionsLabel: "350,000", sessions: 350_000, subCost: 35, usageCost: 712.5, multiplier: 20.4 },
];

const PricingArticleContent = () => {
    const maxUsageCost = 712.5;
    const maxMultiplier = 21;

    return (
        <div className="space-y-6 text-lg font-medium leading-relaxed">

            <p>
                Mobile session replay is one of those tools where pricing theory and pricing reality diverge
                spectacularly. PostHog's session replay is usage-based: you pay per session recorded, and the
                bill compounds through tiers as your app grows. At 25,000 sessions a month PostHog costs
                $85. Rejourney costs $5. That is 17× cheaper — and the gap widens as you scale.
            </p>
            <p>
                This article walks through the exact math, then explains the engineering choices — in the SDK,
                the ingest pipeline, and the infrastructure — that let us sustain a flat price at any session
                count. The cost advantage is not a promotional rate. It follows directly from how we designed
                the system.
            </p>

            {/* Section 01 — The Formula */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        01 // THE MATH
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        One Formula, Three Plans
                    </h2>
                </div>
                <p>
                    The comparison is straightforward. Define <em>C(x)</em> as PostHog's monthly cost at{" "}
                    <em>x</em> sessions, and <em>P(x)</em> as the Rejourney subscription price for the
                    same tier. The multiplier — how many times cheaper Rejourney is — is:
                </p>

                {/* Formula block */}
                <div className="my-8 border-2 border-black bg-white overflow-hidden">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest">
                        Pricing Formula
                    </div>
                    <div className="p-6 sm:p-8 bg-slate-50 space-y-6">
                        <div className="flex flex-col gap-4">
                            <div className="bg-white border-2 border-black p-5">
                                <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Times cheaper</div>
                                <div className="text-xl sm:text-2xl font-black font-mono tracking-tight">
                                    y = C(x) / P(x)
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-white border-2 border-black p-5">
                                    <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Where</div>
                                    <div className="font-mono text-sm space-y-1">
                                        <div><span className="text-blue-700 font-black">x</span> = sessions / month</div>
                                        <div><span className="text-red-600 font-black">C(x)</span> = PostHog price</div>
                                        <div><span className="text-green-700 font-black">P(x)</span> = Rejourney subscription</div>
                                        <div><span className="text-gray-700 font-black">y</span> = how many times cheaper</div>
                                    </div>
                                </div>
                                <div className="bg-white border-2 border-black p-5">
                                    <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Graph points</div>
                                    <div className="font-mono text-sm space-y-1">
                                        <div>(25,000, <span className="text-green-700 font-black">17.0</span>)</div>
                                        <div>(100,000, <span className="text-green-700 font-black">18.2</span>)</div>
                                        <div>(350,000, <span className="text-green-700 font-black">20.4</span>)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 font-medium m-0">
                            The multiplier <strong>grows</strong> as sessions scale because PostHog's tiered rate rises
                            faster than our flat tier increments. At 350,000 sessions/mo the gap is over 20×.
                        </p>
                    </div>
                </div>

                {/* Comparison table */}
                <div className="border-2 border-black bg-white overflow-hidden mt-6">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-black text-white">
                                <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-gray-700">Plan</th>
                                <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-gray-700">Sessions/mo</th>
                                <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-gray-700">
                                    <span className="text-green-400">P(x)</span> — Our Price
                                </th>
                                <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-gray-700">
                                    <span className="text-red-400">C(x)</span> — PostHog
                                </th>
                                <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest">y = C/P</th>
                            </tr>
                        </thead>
                        <tbody>
                            {PLAN_DATA.map((row) => (
                                <tr key={row.plan} className="border-b-2 border-black hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-4 text-sm font-black uppercase border-r-2 border-black">{row.plan}</td>
                                    <td className="py-3 px-4 text-sm font-mono text-right border-r-2 border-black">{row.sessionsLabel}</td>
                                    <td className="py-3 px-4 text-sm font-mono font-black text-right text-green-700 border-r-2 border-black">
                                        ${row.subCost}.00/mo
                                    </td>
                                    <td className="py-3 px-4 text-sm font-mono font-black text-right text-red-600 border-r-2 border-black">
                                        ${row.usageCost.toFixed(2)}/mo
                                    </td>
                                    <td className="py-3 px-4 text-sm font-mono font-black text-right text-blue-700">
                                        {row.multiplier}× cheaper
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Section 02 — Visual Charts */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        02 // THE GAP
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        Seeing the Savings Curve
                    </h2>
                </div>
                <p>
                    The multiplier is not linear. As session volume grows, PostHog's costs compound through
                    pricing tiers faster than our flat increments. Here is what that looks like visually.
                </p>

                {/* Multiplier bar chart */}
                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <TrendingDown size={14} />
                        <span>Cost Multiplier — y = C(x) / P(x)</span>
                    </div>
                    <div className="p-6 space-y-6">
                        {PLAN_DATA.map((row) => (
                            <div key={row.plan}>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-mono text-xs font-black uppercase text-gray-500">
                                        {row.plan} · {row.sessionsLabel} sessions/mo
                                    </div>
                                    <div className="font-mono text-lg font-black text-blue-700">
                                        {row.multiplier}×
                                    </div>
                                </div>
                                <div className="h-10 bg-gray-100 border-2 border-black relative overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 flex items-center justify-end pr-3 transition-all duration-500"
                                        style={{ width: `${(row.multiplier / maxMultiplier) * 100}%` }}
                                    >
                                        <span className="text-white font-mono text-xs font-black">{row.multiplier}×</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono text-gray-400 mt-1">
                                    <span>1×</span>
                                    <span>{maxMultiplier}×</span>
                                </div>
                            </div>
                        ))}
                        <p className="text-sm text-gray-500 font-medium border-t-2 border-gray-100 pt-4 m-0">
                            The multiplier grows because usage-based tiers compound. Our flat subscription stays constant
                            regardless of where you land in the billing cycle.
                        </p>
                    </div>
                </div>

                {/* Absolute cost comparison */}
                <div className="border-2 border-black bg-white overflow-hidden mt-6">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest">
                        Absolute Monthly Cost — Green = Rejourney · Red = PostHog
                    </div>
                    <div className="p-6 space-y-8">
                        {PLAN_DATA.map((row) => (
                            <div key={row.plan}>
                                <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">
                                    {row.plan} — {row.sessionsLabel} sessions/mo
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 text-right text-xs font-black font-mono text-green-700 shrink-0">
                                            ${row.subCost}/mo
                                        </div>
                                        <div className="flex-1 h-8 bg-gray-100 border border-gray-200 relative overflow-hidden">
                                            <div
                                                className="h-full bg-green-600"
                                                style={{ width: `${(row.subCost / maxUsageCost) * 100}%` }}
                                            />
                                        </div>
                                        <div className="w-24 text-xs font-bold text-green-700 shrink-0">Rejourney</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-24 text-right text-xs font-black font-mono text-red-600 shrink-0">
                                            ${row.usageCost.toFixed(2)}/mo
                                        </div>
                                        <div className="flex-1 h-8 bg-gray-100 border border-gray-200 relative overflow-hidden">
                                            <div
                                                className="h-full bg-red-500"
                                                style={{ width: `${(row.usageCost / maxUsageCost) * 100}%` }}
                                            />
                                        </div>
                                        <div className="w-24 text-xs font-bold text-red-600 shrink-0">PostHog</div>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs font-mono text-gray-400">
                                    Annual savings at this tier:{" "}
                                    <span className="text-green-700 font-black">
                                        ${((row.usageCost - row.subCost) * 12).toLocaleString("en-US", { maximumFractionDigits: 0 })}/yr
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Section 03 — SDK Design */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        03 // SDK DESIGN
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        A Lean SDK Is a Cheap SDK
                    </h2>
                </div>
                <p>
                    Every byte the SDK produces has to be stored, processed, and served back. We designed
                    the capture pipeline to produce the smallest correct artifact — not the most complete one.
                    That discipline shows up in storage costs, worker CPU time, and ultimately the subscription
                    price we can sustain.
                </p>

                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Cpu size={14} />
                        <span>SDK Efficiency Decisions</span>
                    </div>
                    {[
                        {
                            label: "1.25× capture scale (not 3× Retina)",
                            detail: "Retina screenshots at 3× scale are ~6–9× larger than our 1.25× equivalent. We capture at 1.25× — sessions remain perfectly readable for debugging while storage and transfer costs drop to a fraction of full-resolution capture.",
                        },
                        {
                            label: "1 FPS with run-loop gating",
                            detail: "We capture 1 frame per second — the SDK default — with the timer scheduled in the default run loop mode (not .common). The system automatically pauses capture during active touches. Zero main-thread interference, and 10× fewer frames than a 10 FPS tool — that is 10× less screenshot storage.",
                        },
                        {
                            label: "Background JPEG + Gzip pipeline",
                            detail: "The main thread performs only the UIKit snapshot. Everything after — JPEG encoding at tuned quality, batching 20 frames, gzip compression — runs on a serialized background queue at Utility QoS. The device's compute budget stays with your app.",
                        },
                        {
                            label: "Hierarchy scan caching (1-second debounce)",
                            detail: "View hierarchy scanning is debounced to once per second for auto-redaction detection. This prevents redundant recursive walks on complex view trees and caps the CPU contribution of the structure pipeline.",
                        },
                        {
                            label: "16ms hierarchy budget + bail-out",
                            detail: "If the view tree is too deep to scan within one frame budget, we stop. We prioritize your app's frame rate over our own data completeness. The replay is still valid — just less hierarchically detailed for that interval.",
                        },
                        {
                            label: "On-device redaction before encoding",
                            detail: "Text fields, password inputs, and camera previews are blacked out in the memory buffer before the JPEG encoder sees them. Private data never enters the artifact. No server-side blurring pipeline needed — one less processing stage, one less cost.",
                        },
                    ].map(({ label, detail }, i) => (
                        <div key={label} className="border-t-2 border-black p-5 bg-white">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-2">
                                {String(i + 1).padStart(2, "0")} — {label}
                            </div>
                            <p className="text-base text-gray-600 font-medium leading-relaxed m-0">{detail}</p>
                        </div>
                    ))}
                </div>

                {/* SDK pipeline flow */}
                <div className="border-2 border-black bg-white overflow-hidden mt-6">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest">
                        On-Device Pipeline (iOS Swift / Android Kotlin)
                    </div>
                    <div className="p-4 sm:p-6 overflow-x-auto">
                        <div className="flex items-stretch gap-0 min-w-[600px]">
                            {[
                                { thread: "MAIN", label: "UIKit snapshot", bg: "bg-red-50 border-red-400", dot: "bg-red-500" },
                                { thread: "BG", label: "JPEG encode (1.25×)", bg: "bg-blue-50 border-blue-400", dot: "bg-blue-500" },
                                { thread: "BG", label: "Batch 20 frames", bg: "bg-blue-50 border-blue-400", dot: "bg-blue-500" },
                                { thread: "BG", label: "Gzip compress", bg: "bg-blue-50 border-blue-400", dot: "bg-blue-500" },
                                { thread: "BG", label: "HTTP/2 upload", bg: "bg-green-50 border-green-400", dot: "bg-green-500" },
                            ].map(({ thread, label, bg, dot }, i, arr) => (
                                <div key={label} className="flex items-center">
                                    <div className={`border-2 ${bg} p-3 text-center min-w-[110px]`}>
                                        <div className={`w-2 h-2 rounded-full ${dot} mx-auto mb-1`} />
                                        <div className="font-mono text-[9px] font-black uppercase text-gray-500">{thread}</div>
                                        <div className="font-mono text-[11px] font-black text-gray-900 mt-1 leading-snug">{label}</div>
                                    </div>
                                    {i < arr.length - 1 && (
                                        <div className="text-gray-400 font-bold text-lg px-1 shrink-0">→</div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 flex gap-4 text-[10px] font-mono font-bold">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Main thread (12ms avg)</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Background (Utility QoS)</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Network</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 04 — Redis Buffered Uploads */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        04 // INGEST PIPELINE
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        The Redis Buffer That Moves S3 Off the Hot Path
                    </h2>
                </div>
                <p>
                    One of the more expensive patterns in session recording infrastructure is calling object
                    storage synchronously in the SDK request path. Every presign-PUT-complete round trip
                    that a user's device waits on is latency you pay for in compute and user experience.
                    We separated the concern entirely.
                </p>
                <p className="mt-4">
                    When the SDK uploads an artifact, the <code>ingest-upload</code> relay service writes
                    the artifact body into Redis under a 30-minute TTL key and immediately returns a 204.
                    The actual S3 write is dequeued asynchronously by a <code>BullMQ</code> worker.
                </p>

                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Database size={14} />
                        <span>Upload Path — SDK to Object Storage</span>
                    </div>
                    <div className="p-4 sm:p-6 overflow-x-auto">
                        <div className="flex items-stretch gap-0 min-w-[680px]">
                            {[
                                { label: "SDK", sub: "PUT artifact body", bg: "bg-slate-50 border-black" },
                                { label: "ingest-upload", sub: "relay pod (HPA 1–2)", bg: "bg-blue-50 border-blue-400" },
                                { label: "Redis", sub: "artifact:buf:{id}\nTTL 30min", bg: "bg-purple-50 border-purple-400" },
                                { label: "BullMQ", sub: "rj-artifact-flush\nqueue", bg: "bg-orange-50 border-orange-400" },
                                { label: "ingest-worker", sub: "flush job", bg: "bg-yellow-50 border-yellow-500" },
                                { label: "OVH", sub: "object storage", bg: "bg-green-50 border-green-500" },
                            ].map(({ label, sub, bg }, i, arr) => (
                                <div key={label} className="flex items-center">
                                    <div className={`border-2 ${bg} p-3 text-center min-w-[100px]`}>
                                        <div className="font-mono text-xs font-black text-gray-900 leading-snug">{label}</div>
                                        <div className="font-mono text-[9px] text-gray-500 mt-1 whitespace-pre-line leading-snug">{sub}</div>
                                    </div>
                                    {i < arr.length - 1 && (
                                        <div className="text-gray-400 font-bold text-lg px-1 shrink-0">→</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-t-2 border-black grid grid-cols-1 sm:grid-cols-3">
                        <div className="border-b-2 sm:border-b-0 sm:border-r-2 border-black p-4 bg-slate-50">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-1">SDK sees</div>
                            <div className="font-mono text-sm font-black text-green-700">204 in &lt;50ms</div>
                            <div className="text-xs text-gray-500 mt-1">No S3 round-trip in path</div>
                        </div>
                        <div className="border-b-2 sm:border-b-0 sm:border-r-2 border-black p-4 bg-white">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-1">Redis key</div>
                            <div className="font-mono text-sm font-black">artifact:buf:{"{artifactId}"}</div>
                            <div className="text-xs text-gray-500 mt-1">30-min TTL, survives worker restarts</div>
                        </div>
                        <div className="p-4 bg-slate-50">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-1">Queue</div>
                            <div className="font-mono text-sm font-black">rj-artifact-flush</div>
                            <div className="text-xs text-gray-500 mt-1">BullMQ, dedup by artifactId</div>
                        </div>
                    </div>
                </div>

                <p className="mt-6">
                    BullMQ deduplicates flush jobs by <code>artifactId</code>. Stalled jobs — where a
                    worker died mid-flush — are automatically re-queued after 30 seconds, up to three
                    attempts. The artifact processing path is idempotent, so re-processing is safe.
                    The result: no artifact is ever lost because a worker crashed, and the ingest-upload
                    pod stays cheap and stateless.
                </p>
            </div>

            {/* Section 05 — Hetzner k3s */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        05 // INFRASTRUCTURE
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        Hetzner + k3s: High Availability Without Hyperscaler Prices
                    </h2>
                </div>
                <p>
                    Cloud-native does not mean AWS. We run a three-node k3s cluster on Hetzner,
                    a European VPS provider with genuinely competitive pricing. The cluster spans
                    two Hetzner datacenters — Falkenstein (FSN1) and Helsinki (HEL1) — giving us
                    cross-DC redundancy for roughly the cost of a single mid-tier managed Kubernetes
                    instance on a hyperscaler.
                </p>

                {/* Node topology */}
                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Server size={14} />
                        <span>Three-Node k3s Cluster — Two EU Datacenters</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black">
                        <div className="p-5 bg-slate-900 text-white">
                            <div className="font-mono text-[10px] font-black uppercase text-blue-400 mb-3">FSN1 · Falkenstein</div>
                            <div className="font-mono text-sm font-black mb-1">rejourney-fsn1-1</div>
                            <div className="font-mono text-[10px] text-gray-400 mb-3">CPX52 · 12 vCPU · 24 GB</div>
                            <div className="space-y-1 text-xs">
                                {["API pods (HPA 3–6)", "Traefik ingress", "Postgres primary (CNPG)", "Redis master (Sentinel)", "pgbouncer pool", "Monitoring stack"].map(s => (
                                    <div key={s} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                        <span className="text-gray-300">{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-5 bg-slate-800 text-white">
                            <div className="font-mono text-[10px] font-black uppercase text-orange-400 mb-3">HEL1 · Helsinki — worker-1</div>
                            <div className="font-mono text-sm font-black mb-1">rejourney-hel1-worker-1</div>
                            <div className="font-mono text-[10px] text-gray-400 mb-3">CX43 · 8 vCPU · 16 GB</div>
                            <div className="space-y-1 text-xs">
                                {["ingest-worker (HPA 5–12)", "replay-worker (HPA 1–10)", "Postgres standby (CNPG)", "Redis replica", "pgbouncer pool"].map(s => (
                                    <div key={s} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                        <span className="text-gray-300">{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-5 bg-slate-800 text-white">
                            <div className="font-mono text-[10px] font-black uppercase text-orange-400 mb-3">HEL1 · Helsinki — quorum-1</div>
                            <div className="font-mono text-sm font-black mb-1">rejourney-hel1-quorum-1</div>
                            <div className="font-mono text-[10px] text-gray-400 mb-3">CX43 · 8 vCPU · 16 GB · excl. LB</div>
                            <div className="space-y-1 text-xs">
                                {["ingest-worker bulk", "replay-worker bulk", "alert-worker", "session-lifecycle-worker", "etcd quorum voter", "Redis replica"].map(s => (
                                    <div key={s} className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                                        <span className="text-gray-300">{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="border-t-2 border-black p-5 bg-white">
                        <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Traffic path</div>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                            {["Browser / SDK", "Cloudflare (TLS · WAF)", "Hetzner LB (FSN1)", "Traefik", "API pods (FSN1-local)", "pgbouncer", "Postgres primary"].map((step, i, arr) => (
                                <span key={step} className="flex items-center gap-2">
                                    <span className="bg-slate-100 border border-black px-2 py-1 font-black text-gray-900">{step}</span>
                                    {i < arr.length - 1 && <span className="text-gray-400">→</span>}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* HA decisions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div className="border-2 border-black p-5 bg-white">
                        <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Postgres HA (CloudNativePG)</div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> Primary on FSN1, sync standby on HEL1</li>
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> <code>synchronous_commit = remote_write</code> — zero data loss on failover</li>
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> Auto-promotion in ~30s, pgbouncer follows new primary</li>
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> WAL archived to Cloudflare R2 (free egress)</li>
                        </ul>
                    </div>
                    <div className="border-2 border-black p-5 bg-white">
                        <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Redis HA (Sentinel)</div>
                        <ul className="space-y-2 text-sm">
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> 3-node Sentinel cluster (1 master, 2 replicas)</li>
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> Quorum 2/3 — HEL1 can elect a master without FSN1</li>
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> <code>maxmemory-policy: noeviction</code> — BullMQ job state is never silently dropped</li>
                            <li className="flex gap-2"><span className="font-black shrink-0">→</span> 8 GiB volumes per node on local-path (Retain)</li>
                        </ul>
                    </div>
                </div>

                <p className="mt-6">
                    k3s is the Kubernetes distribution specifically designed for resource-constrained
                    nodes. Unlike a full kube cluster, k3s ships as a single binary, uses SQLite or
                    embedded etcd, and has a significantly smaller memory footprint per node. On a
                    Hetzner CX43 (16 GB), k3s overhead leaves 14+ GB for actual workloads. On a
                    comparable managed Kubernetes offering the control-plane overhead alone could
                    consume 4–6 GB per node.
                </p>
            </div>

            {/* Section 06 — Object Storage */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        06 // STORAGE
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        EU Object Storage: Multi-Bucket, Multi-Provider
                    </h2>
                </div>
                <p>
                    Session replay artifacts — screenshot frame bundles, event batches, view hierarchy
                    snapshots — land in OVH Object Storage, an S3-compatible provider. The pricing
                    difference between OVH and AWS S3 is significant at scale, and the API surface
                    is identical — no SDK changes, no worker changes, just a different endpoint.
                </p>
                <p className="mt-4">
                    Rather than hard-code a single bucket, we built a{" "}
                    <code>storage_endpoints</code> table in Postgres that drives all artifact routing.
                    Every artifact is pinned to the endpoint that received it — migrations and
                    bucket rollovers never produce "file not found" errors because we always know
                    exactly where a given artifact lives.
                </p>

                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest">
                        Multi-Bucket Storage Topology
                    </div>
                    <div className="p-5 space-y-4">
                        {/* Endpoint resolution */}
                        <div className="border-2 border-black bg-slate-50 p-4">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Endpoint resolution</div>
                            <div className="flex flex-wrap gap-2 items-center text-xs font-mono">
                                <span className="bg-white border-2 border-black px-3 py-2 font-black">Ingest request</span>
                                <span className="text-gray-400 font-bold">→</span>
                                <span className="bg-white border-2 border-black px-3 py-2">Project-specific endpoint?</span>
                                <span className="text-gray-400 font-bold">→ yes →</span>
                                <span className="bg-white border-2 border-black px-3 py-2 text-green-700 font-black">Weighted pick</span>
                                <span className="text-gray-400 font-bold">→</span>
                                <span className="bg-white border-2 border-black px-3 py-2 text-blue-700 font-black">Write + pin artifactId</span>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center text-xs font-mono mt-2">
                                <span className="invisible bg-white border-2 border-black px-3 py-2 font-black">Ingest request</span>
                                <span className="text-gray-400 font-bold">→</span>
                                <span className="bg-white border-2 border-black px-3 py-2">Global default endpoint</span>
                                <span className="text-gray-400 font-bold">→ no →</span>
                                <span className="bg-white border-2 border-black px-3 py-2 text-green-700 font-black">Weighted pick</span>
                                <span className="text-gray-400 font-bold">→</span>
                                <span className="bg-white border-2 border-black px-3 py-2 text-blue-700 font-black">Write + pin artifactId</span>
                            </div>
                        </div>

                        {/* Storage tiers */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="border-2 border-black p-4 bg-white">
                                <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-2">Live artifacts</div>
                                <div className="font-black text-sm mb-1">OVH Object Storage</div>
                                <div className="text-xs text-gray-500">S3-compatible, per-project endpoint pinning, weighted failover across buckets</div>
                            </div>
                            <div className="border-2 border-black p-4 bg-white">
                                <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-2">Shadow replicas</div>
                                <div className="font-black text-sm mb-1">Async fan-out</div>
                                <div className="text-xs text-gray-500">After primary write, shadow endpoints receive async copies for extra durability — no latency impact on the ingest path</div>
                            </div>
                            <div className="border-2 border-black p-4 bg-white">
                                <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-2">WAL archive + backups</div>
                                <div className="font-black text-sm mb-1">Cloudflare R2</div>
                                <div className="text-xs text-gray-500">Zero egress fees, EU edge. Postgres WAL continuous archive + compressed session backups</div>
                            </div>
                        </div>

                        {/* Key layout */}
                        <div className="bg-slate-50 border-2 border-black p-4">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-3">Canonical key layout</div>
                            <pre className="text-xs font-mono text-gray-700 overflow-x-auto">{`tenant/{teamId}/project/{projectId}/sessions/{sessionId}/
├── events/
│   └── events_{batchIndex}_{timestamp}.json.gz
├── hierarchy/
│   └── {timestamp}.json.gz
└── screenshots/
    └── {timestamp}.tar.gz`}</pre>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 07 — GDPR */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        07 // GDPR
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        GDPR-Compliant by Architecture, Not by Checkbox
                    </h2>
                </div>
                <p>
                    Many session replay tools offer GDPR compliance as a configuration option you have to
                    remember to enable. We built it into the default data path. There is no configuration
                    that makes Rejourney non-compliant, because the privacy guarantees are enforced at
                    the only moment that matters: before data leaves the device.
                </p>

                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Shield size={14} />
                        <span>Privacy + Compliance Design</span>
                    </div>
                    {[
                        {
                            label: "On-device redaction, not server-side blurring",
                            detail: "Text inputs (UITextField, UITextView, password fields, camera previews, RCTTextInput) are identified and blacked out in the pixel buffer before the JPEG encoder runs. The private data never enters the artifact. It never leaves the device. There is no server-side blur pipeline that could fail or be accidentally disabled.",
                        },
                        {
                            label: "EU compute — all three k3s nodes in the EU",
                            detail: "All ingestion, processing, and replay serving runs on Hetzner nodes in Falkenstein (Germany) and Helsinki (Finland) — both EU jurisdictions. Session data is processed and served entirely within the EEA. Review your object storage region to confirm end-to-end EU residency for your deployment.",
                        },
                        {
                            label: "Apple PrivacyInfo.xcprivacy included",
                            detail: "The iOS SDK ships a PrivacyInfo.xcprivacy manifest declaring all API usage. App Store submissions using Rejourney have the correct privacy nutrition label entries without any developer action.",
                        },
                        {
                            label: "No third-party data sharing in the ingest path",
                            detail: "The ingest path is: SDK → Cloudflare WAF (TLS termination only) → Hetzner LB → Traefik → our API → our object storage. No analytics vendor, no third-party session processing service, no SaaS observability pipeline sees session data.",
                        },
                        {
                            label: "Sampling and consent hooks",
                            detail: "The SDK checks sampling configuration from /api/sdk/config before any visual capture starts. You can set sampling to 0% for sessions where consent has not been granted, and the SDK will not record a single frame.",
                        },
                    ].map(({ label, detail }, i) => (
                        <div key={label} className="border-t-2 border-black p-5 bg-white">
                            <div className="font-mono text-[10px] font-black uppercase text-gray-500 mb-2">
                                {String(i + 1).padStart(2, "0")} — {label}
                            </div>
                            <p className="text-base text-gray-600 font-medium leading-relaxed m-0">{detail}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 08 — Full system view */}
            <div className="my-12">
                <div className="mb-6">
                    <span className="font-mono text-xs font-black uppercase tracking-widest text-gray-500 mb-2 block">
                        08 // SYSTEM VIEW
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter mb-4">
                        Everything Together
                    </h2>
                </div>
                <p>
                    The cost advantage is additive across every layer. Each engineering decision removes
                    a unit of cost that usage-based pricing models pass directly to the customer.
                </p>

                <div className="border-2 border-black bg-white overflow-hidden mt-8">
                    <div className="bg-black text-white px-5 py-3 font-mono text-[11px] font-black uppercase tracking-widest">
                        Where the Cost Savings Come From
                    </div>
                    <div className="divide-y-2 divide-black">
                        {[
                            {
                                layer: "SDK capture",
                                saving: "~6× fewer bytes per session",
                                how: "1.25× scale instead of 3× Retina · 3 FPS · Gzip compression · run-loop gating skips frames during scrolls",
                                color: "bg-blue-50",
                            },
                            {
                                layer: "Ingest relay",
                                saving: "S3 cost moved off hot path",
                                how: "Redis buffer absorbs PUT latency · BullMQ flushes async · ingest-upload pod is stateless and cheap",
                                color: "bg-purple-50",
                            },
                            {
                                layer: "Workers",
                                saving: "Preferred HEL1, not FSN1",
                                how: "Bulk ingest/replay workers run in Helsinki, leaving FSN1 CPU for API latency · HPA scales on demand · IO-bound workers monitored by queue depth",
                                color: "bg-yellow-50",
                            },
                            {
                                layer: "Database",
                                saving: "No managed RDS / Cloud SQL",
                                how: "CloudNativePG on local-path storage · sync standby for HA · WAL to Cloudflare R2 (free egress) · pgbouncer caps connections at 180",
                                color: "bg-orange-50",
                            },
                            {
                                layer: "Object storage",
                                saving: "OVH vs AWS S3 economics",
                                how: "OVH Object Storage instead of AWS S3 · Cloudflare R2 for WAL archive and backups (zero egress) · multi-bucket topology removes per-bucket object limits",
                                color: "bg-green-50",
                            },
                            {
                                layer: "Compute",
                                saving: "k3s on Hetzner VPS",
                                how: "Three-node HA cluster on commodity European VPS · k3s control-plane overhead is a fraction of managed Kubernetes · no idle node pools",
                                color: "bg-slate-50",
                            },
                        ].map(({ layer, saving, how, color }) => (
                            <div key={layer} className={`p-5 ${color}`}>
                                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                    <div className="sm:w-32 shrink-0">
                                        <div className="font-mono text-[10px] font-black uppercase text-gray-500">Layer</div>
                                        <div className="font-black text-sm text-gray-900">{layer}</div>
                                    </div>
                                    <div className="sm:w-48 shrink-0">
                                        <div className="font-mono text-[10px] font-black uppercase text-gray-500">Saving</div>
                                        <div className="font-black text-sm text-green-700">{saving}</div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-mono text-[10px] font-black uppercase text-gray-500">How</div>
                                        <div className="text-sm text-gray-700 font-medium">{how}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Closing */}
            <div className="my-12 border-2 border-black bg-black text-white p-8">
                <div className="font-mono text-[11px] font-black uppercase tracking-widest text-gray-400 mb-4">Bottom line</div>
                <p className="text-gray-200 text-lg font-medium m-0 leading-relaxed">
                    The 17× price difference vs PostHog at 25,000 sessions is not a promotional rate. It follows
                    directly from running a lean 1 FPS SDK, an async Redis-buffered ingest pipeline, HA
                    Kubernetes on Hetzner bare-metal, and OVH object storage instead of AWS S3 — with
                    on-device redaction baked into the default capture path. Every one of those choices
                    compounds. The multiplier grows to 20× at 350,000 sessions/mo because we did not build
                    a cost structure that scales linearly with volume.
                </p>
                <p className="text-gray-400 text-base font-medium mt-4 m-0">
                    If you are evaluating PostHog alternatives for a production React Native app and cost
                    is a real constraint, the math is in the table above. We think it speaks for itself.
                </p>
            </div>

        </div>
    );
};

export const mobileSessionReplayCostArticle: Article = {
    id: "mobile-session-replay-cost",
    title: "17× Cheaper Than PostHog Session Replay",
    subtitle: "The pricing math comparing Rejourney vs PostHog, and the engineering stack — lean 1 FPS native SDK, Redis-buffered ingest, Hetzner k3s HA — that makes a flat subscription possible at any session volume.",
    seoKeywords:
        "session replay pricing comparison, react native session replay cost, mobile observability budget, GDPR session replay, EU mobile analytics tool, affordable session replay, fixed price session recording, mobile crash reporting pricing, posthog alternative react native, logrocket alternative cost",
    seo: {
        primaryKeyword: "session replay pricing",
        metaTitle: "Session Replay Pricing: Rejourney vs PostHog Cost Math",
        metaDescription:
            "Compare React Native session replay pricing: Rejourney fixed plans vs PostHog usage billing, with exact cost math and infra decisions.",
        targetKeywords: [
            "session replay pricing",
            "PostHog session replay cost",
            "React Native session replay pricing",
            "mobile observability cost",
            "fixed price session replay",
            "PostHog alternative",
            "LogRocket alternative cost",
            "mobile crash reporting pricing",
        ],
        topicTags: ["Pricing", "Session Replay", "PostHog Alternative", "React Native", "Mobile Observability"],
    },
    date: "May 06, 2026",
    urlDate: "2026-05-06",
    dateModified: "2026-05-06",
    readTime: "12 min read",
    author: {
        name: "Mohammad Rashid",
        url: "https://www.linkedin.com/in/mohammad-rashid7337/",
        github: "https://github.com/Mohammad-R-Rashid",
    },
    image: "https://rejourney.co/assets/engineering/mobile-session-replay-cost.png",
    schema: pricingArticleSchema,
    content: <PricingArticleContent />,
};
