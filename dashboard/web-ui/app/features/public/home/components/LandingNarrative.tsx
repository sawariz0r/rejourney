import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
    ArrowRight,
    Bug,
    CheckCircle2,
    ClipboardList,
    Code2,
    Eye,
    Globe2,
    MousePointerClick,
    Palette,
    TrendingUp,
} from 'lucide-react';
import type { MarketingHomeCopy } from '~/shared/lib/internationalMarketing';

type SankeyNode = {
    id: string;
    label: string;
    value: string;
    meta?: string;
    x: number;
    y: number;
    h: number;
    w?: number;
    color: string;
    labelX: number;
    labelY: number;
    labelAnchor?: 'start' | 'end';
};

type SankeyFlow = {
    from: string;
    to: string;
    fromY: number;
    toY: number;
    width: number;
    color: string;
    delay: number;
    sweep?: number;
    opacity?: number;
};

const sankeyStages = [
    { step: '01', label: 'Find Revenue blockers', x: 42, width: 365, color: '#2563eb' },
    { step: '02', label: 'Fix + Ship', x: 430, width: 330, color: '#f59e0b' },
    { step: '03', label: 'Revenue lift', x: 790, width: 370, color: '#16a34a' },
];

const sankeyNodes: SankeyNode[] = [
    { id: 'scan', label: 'Onboarding', value: '2,857', x: 42, y: 88, h: 258, color: '#5dadec', labelX: 62, labelY: 58 },
    { id: 'paymentDropoff', label: 'Payment drop-off', value: '545', x: 204, y: 68, h: 62, color: '#6366f1', labelX: 224, labelY: 72 },
    { id: 'paymentReplay', label: 'Replay', value: 'pay error', x: 420, y: 204, h: 54, color: '#f97316', labelX: 438, labelY: 214 },
    { id: 'checkoutFix', label: 'Checkout fix', value: 'shipped', x: 636, y: 126, h: 62, color: '#0f766e', labelX: 654, labelY: 130 },
    { id: 'planExits', label: 'Plan exits', value: '312', x: 232, y: 184, h: 60, color: '#8b5cf6', labelX: 252, labelY: 190 },
    { id: 'pricingReplay', label: 'Replay', value: 'pricing doubt', x: 386, y: 102, h: 54, color: '#f59e0b', labelX: 404, labelY: 106 },
    { id: 'paywallFix', label: 'Paywall fix', value: 'shipped', x: 602, y: 252, h: 62, color: '#ca8a04', labelX: 620, labelY: 264 },
    { id: 'checkoutCrashes', label: 'Checkout crashes', value: '104', x: 214, y: 300, h: 62, color: '#fb7185', labelX: 234, labelY: 306 },
    { id: 'crashReplay', label: 'Replay', value: 'crash loop', x: 392, y: 326, h: 54, color: '#ef4444', labelX: 410, labelY: 332 },
    { id: 'crashPatch', label: 'Crash patch', value: 'shipped', x: 664, y: 292, h: 62, color: '#dc2626', labelX: 682, labelY: 300 },
    { id: 'outcomeRevenue', label: 'Revenue lift', value: '+15%', meta: 'After checkout fix', x: 900, y: 76, h: 62, w: 20, color: '#84cc16', labelX: 934, labelY: 76 },
    { id: 'outcomeFunnel', label: 'Funnel lift', value: '+20%', meta: 'After paywall fix', x: 900, y: 202, h: 62, w: 20, color: '#22c55e', labelX: 934, labelY: 202 },
    { id: 'outcomeErrors', label: 'Checkout errors', value: '-28%', meta: 'After crash patch', x: 900, y: 318, h: 62, w: 20, color: '#14b8a6', labelX: 934, labelY: 318 },
];

const sankeyFlows: SankeyFlow[] = [
    { from: 'scan', fromY: 116, to: 'paymentDropoff', toY: 99, width: 29, color: '#5dadec', delay: 80, sweep: -12, opacity: 0.2 },
    { from: 'scan', fromY: 218, to: 'planExits', toY: 214, width: 24, color: '#5dadec', delay: 120, sweep: 10, opacity: 0.18 },
    { from: 'scan', fromY: 326, to: 'checkoutCrashes', toY: 331, width: 18, color: '#5dadec', delay: 160, sweep: 18, opacity: 0.16 },
    { from: 'paymentDropoff', fromY: 99, to: 'paymentReplay', toY: 231, width: 25, color: '#6366f1', delay: 240, sweep: 32, opacity: 0.27 },
    { from: 'planExits', fromY: 214, to: 'pricingReplay', toY: 129, width: 22, color: '#8b5cf6', delay: 280, sweep: -30, opacity: 0.25 },
    { from: 'paymentReplay', fromY: 231, to: 'checkoutFix', toY: 157, width: 23, color: '#f97316', delay: 340, sweep: -24, opacity: 0.26 },
    { from: 'pricingReplay', fromY: 129, to: 'paywallFix', toY: 283, width: 20, color: '#f59e0b', delay: 380, sweep: 34, opacity: 0.24 },
    { from: 'checkoutCrashes', fromY: 331, to: 'crashReplay', toY: 353, width: 16, color: '#fb7185', delay: 320, sweep: 22, opacity: 0.22 },
    { from: 'crashReplay', fromY: 353, to: 'crashPatch', toY: 323, width: 15, color: '#ef4444', delay: 420, sweep: -18, opacity: 0.24 },
    { from: 'checkoutFix', fromY: 157, to: 'outcomeRevenue', toY: 107, width: 25, color: '#84cc16', delay: 460, sweep: -20, opacity: 0.26 },
    { from: 'paywallFix', fromY: 283, to: 'outcomeFunnel', toY: 233, width: 21, color: '#22c55e', delay: 500, sweep: -12, opacity: 0.23 },
    { from: 'crashPatch', fromY: 323, to: 'outcomeErrors', toY: 349, width: 16, color: '#14b8a6', delay: 540, sweep: 20, opacity: 0.23 },
];

const nodeById = sankeyNodes.reduce<Record<string, SankeyNode>>((acc, node) => {
    acc[node.id] = node;
    return acc;
}, {});

const ribbonPath = (from: SankeyNode, fromY: number, to: SankeyNode, toY: number, sweep = 0): string => {
    const fromX = from.x + (from.w ?? 14);
    const toX = to.x;
    const bend = Math.max(68, (toX - fromX) * 0.46);
    return [
        `M ${fromX} ${fromY}`,
        `C ${fromX + bend} ${fromY + sweep}, ${toX - bend} ${toY - sweep}, ${toX} ${toY}`,
    ].join(' ');
};

const SankeyLabel: React.FC<{ node: SankeyNode }> = ({ node }) => {
    if (node.id.startsWith('outcome')) {
        const nodeWidth = node.w ?? 14;
        const cardX = node.labelX;
        const cardY = node.labelY;
        const cardWidth = 220;
        const cardHeight = 58;
        const title = `${node.value} ${node.label}`.toUpperCase();

        return (
            <g>
                <path
                    d={`M ${node.x + nodeWidth} ${node.y + node.h / 2} H ${cardX}`}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                    opacity="0.3"
                />
                {/* neo-brutalist shadow */}
                <rect x={cardX + 3} y={cardY + 3} width={cardWidth} height={cardHeight} fill="#0f172a" />
                {/* card background */}
                <rect x={cardX} y={cardY} width={cardWidth} height={cardHeight} fill="white" stroke="#0f172a" strokeWidth="2" />
                {/* outcome accent bar */}
                <rect x={cardX} y={cardY} width="6" height={cardHeight} fill={node.color} />
                <text x={cardX + 16} y={cardY + 23} fill="#0f172a" fontSize="13.5" fontWeight="950" fontFamily="monospace" letterSpacing="0.2">
                    {title}
                </text>
                <text x={cardX + 16} y={cardY + 42} fill="#64748b" fontSize="9.5" fontWeight="800" fontFamily="monospace" letterSpacing="0.7">
                    {node.meta?.toUpperCase()}
                </text>
            </g>
        );
    }

    const text = `${node.label}: ${node.value}`;
    const width = Math.max(76, text.length * 6.1 + 18);
    const x = node.labelAnchor === 'end' ? node.labelX - width : node.labelX;
    const y = node.labelY;

    return (
        <g>
            <rect x={x} y={y} width={width} height="24" rx="2" fill="rgba(255,255,255,0.94)" stroke="rgba(15,23,42,0.18)" />
            <text x={x + 8} y={y + 16.2} fill="#0f172a" fontSize="11.5" fontWeight="850">
                {text}
            </text>
        </g>
    );
};

const SankeyDiagram: React.FC<{ active: boolean }> = ({ active }) => (
    <svg
        viewBox="0 0 1200 430"
        className="mx-auto h-auto w-full max-w-[1580px]"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
    >
        <defs>
            <filter id="sankeySoftShadow" x="-8%" y="-12%" width="116%" height="124%">
                <feDropShadow dx="0" dy="7" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.09" />
            </filter>
        </defs>
        {sankeyStages.map((stage) => (
            <g key={stage.label} opacity={active ? 1 : 0} style={{ transition: 'opacity 0.35s ease-out' }}>
                <text x={stage.x} y="22" fill={stage.color} fontSize="13" fontWeight="950" letterSpacing="0.7">
                    {stage.step} / {stage.label.toUpperCase()}
                </text>
                <path d={`M ${stage.x} 35 H ${stage.x + stage.width - 18}`} stroke={stage.color} strokeWidth="3.2" strokeLinecap="round" opacity="0.62" />
            </g>
        ))}
        {sankeyFlows.map((flow) => {
            const from = nodeById[flow.from];
            const to = nodeById[flow.to];
            const path = ribbonPath(from, flow.fromY, to, flow.toY, flow.sweep ?? 0);
            return (
                <g
                    key={`${flow.from}-${flow.to}-${flow.toY}`}
                    opacity={active ? 1 : 0}
                    style={{ transition: `opacity 0.45s ${flow.delay}ms ease-out` }}
                >
                    <path
                        d={path}
                        fill="none"
                        stroke="#f8fafc"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={flow.width + 8}
                        opacity="0.86"
                    />
                    <path
                        d={path}
                        fill="none"
                        stroke={flow.color}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={flow.width}
                        opacity={flow.opacity ?? 0.24}
                    />
                </g>
            );
        })}
        {sankeyNodes.map((node) => (
            <g key={node.id}>
                <rect
                    x={node.x}
                    y={node.y}
                    width={node.w ?? 14}
                    height={node.h}
                    rx="2"
                    fill={node.color}
                    filter="url(#sankeySoftShadow)"
                    opacity={active ? 1 : 0}
                    style={{ transition: `opacity 0.35s 120ms ease-out` }}
                />
                <SankeyLabel node={node} />
            </g>
        ))}
    </svg>
);

const mobileJourneyPaths = [
    {
        blocker: 'Payment drop-off',
        metric: '545 sessions',
        evidence: 'Replay shows pay error',
        fix: 'Checkout fix shipped',
        outcome: '+15% revenue increase',
        color: '#6366f1',
    },
    {
        blocker: 'Plan screen exits',
        metric: '312 sessions',
        evidence: 'Replay shows pricing doubt',
        fix: 'Paywall fix shipped',
        outcome: '+20% funnel improvement',
        color: '#8b5cf6',
    },
    {
        blocker: 'Checkout crashes',
        metric: '104 exits',
        evidence: 'Replay shows crash loop',
        fix: 'Crash patch shipped',
        outcome: '-28% checkout errors',
        color: '#fb7185',
    },
];

const MobileSankeyDiagram: React.FC<{ active: boolean }> = ({ active }) => (
    <div className="space-y-3" aria-hidden>
        {mobileJourneyPaths.map((path, index) => (
            <div
                key={path.blocker}
                className="border-2 border-black bg-white p-3 shadow-neo"
                style={{
                    opacity: active ? 1 : 0,
                    transform: active ? 'translateY(0)' : 'translateY(8px)',
                    transition: `opacity 0.35s ${index * 90}ms ease-out, transform 0.35s ${index * 90}ms ease-out`,
                }}
            >
                <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.06em]" style={{ color: path.color }}>
                        0{index + 1} / Identify
                    </span>
                    <span className="text-right text-[10px] font-black uppercase tracking-[0.06em] text-[#16a34a]">
                        Outcome
                    </span>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] items-stretch gap-3">
                    <div className="min-w-0">
                        <div className="grid grid-cols-[10px_1fr] gap-x-3">
                            <span className="mt-1 h-2.5 w-2.5 bg-current" style={{ color: path.color }} />
                            <div>
                                <p className="break-words text-sm font-black text-slate-950">{path.blocker}</p>
                                <p className="mt-1 text-xs font-bold text-slate-500">{path.metric}</p>
                            </div>
                            <span className="mx-auto my-1 h-8 w-[2px] bg-slate-200" />
                            <p className="self-center break-words text-sm font-black text-slate-950">{path.evidence}</p>
                            <span className="mx-auto my-1 h-8 w-[2px] bg-slate-200" />
                            <p className="self-center break-words text-sm font-black text-slate-950">{path.fix}</p>
                        </div>
                    </div>
                    <div className="flex min-w-[112px] max-w-[132px] items-center border-l-[6px] border-[#84cc16] bg-[#f0fdf4] px-3 py-2">
                        <p className="break-words text-sm font-black uppercase leading-tight text-slate-950">{path.outcome}</p>
                    </div>
                </div>
            </div>
        ))}
    </div>
);

const JourneyActionLoop: React.FC = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([e]) => {
                if (e.isIntersecting) {
                    setActive(true);
                    io.disconnect();
                }
            },
            { threshold: 0.12 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (
        <div ref={ref} className="relative mt-7 min-w-0 sm:mt-9">
            <div className="relative hidden overflow-hidden md:block" dir="ltr">
                <SankeyDiagram active={active} />
            </div>
            <div className="relative md:hidden">
                <MobileSankeyDiagram active={active} />
            </div>
        </div>
    );
};

const productStories = [
    {
        copyIndex: 0,
        eyebrow: 'Session recordings',
        title: 'Watch real users move through your app.',
        copy: 'Replay mobile sessions with enough context to answer the question everyone asks first: what actually happened?',
        bullets: ['Pixel-perfect mobile replay', 'Touch trails and screen changes', 'Network, logs, and device context'],
        image: '/images/session-replay-preview.png',
        alt: 'Rejourney session replay preview',
        icon: Eye,
        accent: 'bg-[#e8f4ff]',
    },
    {
        copyIndex: 1,
        eyebrow: 'Heatmaps and journeys',
        title: 'See what grabs attention and where people drop.',
        copy: 'Turn scattered taps, swipes, scrolls, and exits into a map of the screens that help or hurt conversion.',
        bullets: ['Tap and rage-tap clusters', 'Journey maps across screens', 'Drop-off points by flow'],
        image: '/images/heatmaps.png',
        alt: 'Rejourney touch heatmaps preview',
        icon: MousePointerClick,
        accent: 'bg-[#ffe4e6]',
    },
    {
        copyIndex: 3,
        eyebrow: 'Growth loops',
        title: 'Connect product quality to retention.',
        copy: 'Measure whether releases are creating better sessions, calmer funnels, and more users who come back.',
        bullets: ['Retention and loyalty segments', 'Release impact signals', 'Funnel recovery opportunities'],
        image: '/images/growth-engines.png',
        alt: 'Rejourney growth analytics preview',
        icon: TrendingUp,
        accent: 'bg-[#dcfce7]',
    },
    {
        eyebrow: 'Geographic analytics',
        title: 'See API response and sentiment by region.',
        copy: 'Spot where latency, errors, and user sentiment change across countries before regional issues turn into churn.',
        bullets: ['API response times by city', 'Regional sentiment signals', 'Geo health and session context'],
        image: '/images/geo-analytics.png',
        alt: 'Rejourney geographic analytics globe preview',
        icon: Globe2,
        accent: 'bg-[#ccfbf1]',
    },
    {
        copyIndex: 2,
        eyebrow: 'Crashes and ANRs',
        title: 'Tie broken experiences to the session that caused them.',
        copy: 'Crash reporting is more useful when it sits beside replay, thread analysis, device details, and the user path.',
        bullets: ['Crash and ANR detection', 'Main-thread performance clues', 'Incident stream for triage'],
        image: '/images/anr-issues.png',
        alt: 'Rejourney ANR and crash detection preview',
        icon: Bug,
        accent: 'bg-[#fef9c3]',
        imagePanelClassName: 'bg-white p-2 sm:p-3 lg:self-center',
        imageFrameClassName: 'flex bg-[#fef9c3] p-3 sm:p-4',
        imageClassName: 'h-auto w-full object-contain object-left-top',
        technicalLast: true,
    },
];

const workspaceRoles = [
    {
        label: 'PM',
        icon: ClipboardList,
        className: 'text-[#f97316]',
    },
    {
        label: 'UX',
        icon: Palette,
        className: 'text-[#ec4899]',
    },
    {
        label: 'DEV',
        icon: Code2,
        className: 'text-[#2563eb]',
    },
];

const workspaceCursors = [
    {
        label: 'PM',
        color: '#f97316',
        softColor: 'rgba(249, 115, 22, 0.16)',
        left: '24%',
        top: '27%',
    },
    {
        label: 'UX',
        color: '#ec4899',
        softColor: 'rgba(236, 72, 153, 0.15)',
        left: '67%',
        top: '56%',
    },
    {
        label: 'DEV',
        color: '#2563eb',
        softColor: 'rgba(93, 173, 236, 0.2)',
        left: '88%',
        top: '31%',
    },
];

export const LandingNarrative: React.FC<{ copy: MarketingHomeCopy['narrative']; dir?: 'ltr' | 'rtl' }> = ({ copy, dir = 'ltr' }) => {
    const renderedStories = productStories.map((story) => {
        const localizedStory = typeof story.copyIndex === 'number' ? copy.productStories[story.copyIndex] : undefined;
        return {
            ...story,
            ...(localizedStory ?? {}),
        };
    });
    const orderedStories = [
        ...renderedStories.filter((story) => !story.technicalLast),
        ...renderedStories.filter((story) => story.technicalLast),
    ];
    const alignClass = dir === 'rtl' ? 'text-right' : 'text-left';

    return (
        <div dir={dir} className={alignClass}>
            <section id="journey-action-center" className="relative w-full overflow-hidden border-b-2 border-black bg-[#f8fafc] px-4 pb-4 pt-10 text-slate-950 sm:px-6 sm:pb-8 sm:pt-14 lg:px-8">
                <div className="relative mx-auto max-w-[1680px]">
                    <div className="max-w-5xl lg:ml-2">
                        <p className="mb-3 text-[11px] font-black uppercase text-[#2563eb]">{copy.loopEyebrow}</p>
                        <h2 className="break-words text-4xl font-black uppercase leading-[0.96] sm:text-5xl lg:text-6xl">
                            {copy.loopHeadingLines.map((line) => (
                                <span key={line} className="block">{line}</span>
                            ))}
                        </h2>
                        <p className="mt-5 max-w-3xl text-base font-bold leading-relaxed text-slate-600 sm:text-lg lg:text-xl">
                            {copy.loopIntro}
                        </p>
                    </div>

                    <JourneyActionLoop />
                </div>
            </section>

            <section className="w-full bg-[#f8fafc] px-4 py-14 text-slate-950 sm:px-6 sm:py-24 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="mb-10 flex flex-col gap-5 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
                        <div className="min-w-0">
                            <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">{copy.signalsEyebrow}</p>
                            <h2 className="max-w-4xl break-words text-3xl font-black uppercase leading-tight tracking-tight sm:text-6xl">
                                {copy.signalsHeading}
                            </h2>
                        </div>
                        <Link
                            to="/demo"
                            className="inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-[#fef08a] px-5 py-3 text-sm font-black uppercase text-black shadow-neo transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#67e8f9] hover:shadow-neo-lg active:translate-x-0 active:translate-y-0 active:shadow-none sm:w-auto sm:px-6 sm:py-4"
                        >
                            {copy.demoCta}
                            <ArrowRight size={17} strokeWidth={3} />
                        </Link>
                    </div>

                    <div className="space-y-5 lg:space-y-7">
                        {orderedStories.map((story, index) => {
                            const Icon = story.icon;
                            const imageOrder = index % 2 === 1 ? 'lg:order-last' : '';

                            return (
                                <article
                                    key={story.title}
                                    className="grid overflow-hidden bg-white lg:grid-cols-2"
                                >
                                    <div className={`${story.imagePanelClassName ?? 'min-h-[220px] bg-white p-2 sm:min-h-[260px] sm:p-3 lg:min-h-[420px]'} ${imageOrder}`}>
                                        <div className={story.imageFrameClassName ?? `flex h-full items-center ${story.accent} p-3`}>
                                            <img
                                                src={story.image}
                                                alt={story.alt}
                                                className={story.imageClassName ?? 'h-full max-h-[390px] w-full object-cover object-left-top'}
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8 lg:p-12">
                                        <div className={`mb-6 grid h-12 w-12 shrink-0 place-items-center ${story.accent}`}>
                                            <Icon size={22} strokeWidth={2.7} />
                                        </div>
                                        <p className="mb-3 text-[11px] font-black uppercase text-slate-400">{story.eyebrow}</p>
                                        <h3 className="max-w-xl break-words text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
                                            {story.title}
                                        </h3>
                                        <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-slate-600">{story.copy}</p>
                                        <div className="mt-6 grid gap-3">
                                            {story.bullets.map((bullet) => (
                                                <div key={bullet} className="flex items-center gap-3 text-sm font-black text-slate-800">
                                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" strokeWidth={3} />
                                                    {bullet}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="w-full border-t-2 border-b-2 border-black bg-white px-4 py-14 text-slate-950 sm:px-6 sm:py-20 lg:px-8">
                <div className="mx-auto grid max-w-[1440px] gap-8 lg:grid-cols-[0.56fr_1.44fr] lg:items-center">
                    <div className="min-w-0">
                        <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">{copy.trustEyebrow}</p>
                        <h2 className="max-w-lg break-words text-4xl font-black uppercase leading-[0.96] tracking-tight sm:text-5xl">
                            {copy.trustHeading}
                        </h2>
                        <p className="mt-5 max-w-md text-base font-bold leading-relaxed text-slate-600">
                            {copy.trustCopy}
                        </p>

                        <div className="landing-workspace-role-list">
                            {workspaceRoles.map((role) => {
                                const Icon = role.icon;
                                return (
                                    <span key={role.label} className="landing-workspace-role">
                                        <Icon className={`landing-workspace-role__icon ${role.className}`} strokeWidth={3} />
                                        {role.label}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    <div className="min-w-0">
                        <div className="landing-workspace-frame">
                            <div className="landing-workspace-frame__mat" aria-hidden>
                                <div className="landing-workspace-frame__dots">
                                    <span className="landing-workspace-frame__dot landing-workspace-frame__dot--red" />
                                    <span className="landing-workspace-frame__dot landing-workspace-frame__dot--yellow" />
                                    <span className="landing-workspace-frame__dot landing-workspace-frame__dot--green" />
                                </div>
                                <div className="landing-workspace-frame__urlbar">
                                    <span className="landing-workspace-frame__urlbar-dot" />
                                    <span className="landing-workspace-frame__urlbar-text">rejourney.co/dashboard</span>
                                </div>
                            </div>
                            <div className="landing-workspace-frame__screen">
                                <img
                                    src="/images/one-room-for-all.png"
                                    alt="Rejourney workspace showing analytics, replay theater, console evidence, and mobile session context"
                                    className="landing-workspace-frame__image"
                                    loading="lazy"
                                    decoding="async"
                                />
                                <div className="absolute inset-0 pointer-events-none" aria-hidden>
                                    {workspaceCursors.map((cursor) => (
                                        <div
                                            key={cursor.label}
                                            className="landing-workspace-cursor"
                                            style={{
                                                left: cursor.left,
                                                top: cursor.top,
                                                '--cursor-color': cursor.color,
                                                '--cursor-soft': cursor.softColor,
                                            } as React.CSSProperties}
                                        >
                                            <span className="landing-workspace-cursor__trail" />
                                            <svg width="42" height="48" viewBox="0 0 42 48" fill="none" className="landing-workspace-cursor__pointer">
                                                <path
                                                    d="M5 3.5L7.1 36.8L16.2 28.1L23.3 43.2L32.5 38.9L25.2 24.6H38.3L5 3.5Z"
                                                    fill="white"
                                                    stroke="white"
                                                    strokeWidth="7"
                                                    strokeLinejoin="round"
                                                />
                                                <path
                                                    d="M5 3.5L7.1 36.8L16.2 28.1L23.3 43.2L32.5 38.9L25.2 24.6H38.3L5 3.5Z"
                                                    fill={cursor.color}
                                                    stroke="#020617"
                                                    strokeWidth="2.5"
                                                    strokeLinejoin="round"
                                                />
                                                <path d="M11.2 12.2L12.2 27.2L16.8 22.8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />
                                            </svg>
                                            <span className="landing-workspace-cursor__label">
                                                {cursor.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="w-full bg-[#e8f4ff] px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
                <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                    <div className="border-2 border-black bg-white px-6 py-5 shadow-neo-sm">
                        <div className="text-3xl font-black leading-none sm:text-5xl">{copy.stats.cheaper}</div>
                        <div className="mt-3 max-w-xl text-[12px] font-black uppercase leading-relaxed text-slate-500">
                            {copy.stats.cheaperCopy}
                        </div>
                    </div>
                    <div className="border-2 border-black bg-white px-6 py-5 shadow-neo-sm">
                        <div className="text-3xl font-black leading-none sm:text-4xl">{copy.stats.freeSessions}</div>
                        <div className="mt-3 text-[11px] font-black uppercase text-slate-500">{copy.stats.everyMonth}</div>
                    </div>
                    <div className="border-2 border-black bg-white px-6 py-5 shadow-neo-sm">
                        <div className="text-3xl font-black leading-none">{copy.stats.allFeatures}</div>
                        <div className="mt-3 text-[11px] font-black uppercase text-slate-500">{copy.stats.allFeaturesCopy}</div>
                    </div>
                </div>
            </section>
        </div>
    );
};
