import React from 'react';
import { Link } from 'react-router';
import {
    ArrowRight,
    Bug,
    CheckCircle2,
    Eye,
    EyeOff,
    Github,
    LockKeyhole,
    MousePointerClick,
    Server,
    ShieldCheck,
    TrendingUp,
    Zap,
} from 'lucide-react';
import { MarkExpo, MarkReactNative, MarkSwift } from './PlatformMarks';
import type { MarketingHomeCopy } from '~/shared/lib/internationalMarketing';

const EuFlag: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="European Union flag">
        <rect width="48" height="32" rx="6" fill="#1d4ed8" />
        {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const cx = (24 + Math.cos(angle) * 8.5).toFixed(3);
            const cy = (16 + Math.sin(angle) * 8.5).toFixed(3);
            return <circle key={index} cx={cx} cy={cy} r="1.2" fill="#fde047" />;
        })}
    </svg>
);

const journeySteps = [
    {
        label: 'Watch',
        title: 'Replay the exact mobile session',
        signal: 'Screens, taps, swipes, navigation, crashes, and network context.',
        move: 'See the exact moment a user hesitates instead of inferring it from a chart.',
        icon: Eye,
        tone: 'bg-[#dbeafe]',
        strip: 'bg-[#5dadec]',
    },
    {
        label: 'Understand',
        title: 'Find the friction pattern',
        signal: 'Heatmaps, journeys, rage taps, crash reports, and ANRs.',
        move: 'Turn one strange session into a repeated pattern the team can name.',
        icon: MousePointerClick,
        tone: 'bg-[#ffe4e6]',
        strip: 'bg-[#f9a8d4]',
    },
    {
        label: 'Act',
        title: 'Ship the fix with confidence',
        signal: 'Replay-backed evidence for product, engineering, support, and growth.',
        move: 'Decide what to fix before the next release repeats the same failure.',
        icon: CheckCircle2,
        tone: 'bg-[#dcfce7]',
        strip: 'bg-[#86efac]',
    },
];

const productStories = [
    {
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
        eyebrow: 'Crashes and ANRs',
        title: 'Tie broken experiences to the session that caused them.',
        copy: 'Crash reporting is more useful when it sits beside replay, thread analysis, device details, and the user path.',
        bullets: ['Crash and ANR detection', 'Main-thread performance clues', 'Incident stream for triage'],
        image: '/images/anr-issues.png',
        alt: 'Rejourney ANR and crash detection preview',
        icon: Bug,
        accent: 'bg-[#fef9c3]',
    },
    {
        eyebrow: 'Growth loops',
        title: 'Connect product quality to retention.',
        copy: 'Measure whether releases are creating better sessions, calmer funnels, and more users who come back.',
        bullets: ['Retention and loyalty segments', 'Release impact signals', 'Funnel recovery opportunities'],
        image: '/images/growth-engines.png',
        alt: 'Rejourney growth analytics preview',
        icon: TrendingUp,
        accent: 'bg-[#dcfce7]',
    },
];

const trustCards = [
    {
        title: 'GDPR compliance',
        copy: 'EU-oriented controls for masking, redaction, data minimization, and optional geolocation collection.',
        icon: ShieldCheck,
        flag: true,
        className: 'sm:col-span-2 bg-[#eff6ff]',
    },
    {
        title: 'Open source',
        copy: 'Inspect the code, verify the SDK behavior, and keep the roadmap accountable to real mobile teams.',
        icon: Github,
        className: 'bg-white',
    },
    {
        title: 'Self-hostable',
        copy: 'Run Rejourney on your own infrastructure when recordings and metadata need to stay under your control.',
        icon: Server,
        className: 'bg-white',
    },
    {
        title: 'Privacy controls',
        copy: 'Mask sensitive UI, redact fields, avoid unnecessary location data, and keep collection intentional.',
        icon: LockKeyhole,
        className: 'bg-white',
    },
    {
        title: 'Light mobile SDK',
        copy: "A 13.2 kB gzipped React Native SDK with async capture work kept out of the user's way.",
        icon: Zap,
        className: 'bg-white',
    },
    {
        title: 'Observe-only mode',
        copy: 'Set observeOnly: true to disable visual session replay while still sending anonymized telemetry for errors, crashes, ANRs, network activity, and events.',
        icon: EyeOff,
        className: 'sm:col-span-2 bg-[#f8fafc]',
    },
];

export const LandingNarrative: React.FC<{ copy: MarketingHomeCopy['narrative']; dir?: 'ltr' | 'rtl' }> = ({ copy, dir = 'ltr' }) => {
    const renderedSteps = journeySteps.map((step, index) => ({
        ...step,
        ...(copy.steps[index] ?? {}),
    }));
    const renderedStories = productStories.map((story, index) => ({
        ...story,
        ...(copy.productStories[index] ?? {}),
    }));
    const renderedTrustCards = trustCards.map((card, index) => ({
        ...card,
        ...(copy.trustCards[index] ?? {}),
    }));
    const alignClass = dir === 'rtl' ? 'text-right' : 'text-left';

    return (
        <div dir={dir} className={alignClass}>
            <section className="relative w-full overflow-hidden border-b-2 border-black bg-[#f8fafc] px-4 py-14 text-slate-950 sm:px-6 sm:py-20 lg:px-8">
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#000_1px,transparent_1px),linear-gradient(90deg,#000_1px,transparent_1px)] [background-size:34px_34px]"
                    aria-hidden
                />
                <div className="relative mx-auto max-w-7xl">
                    <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
                        <div className="min-w-0">
                            <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">{copy.loopEyebrow}</p>
                            <h2 className="max-w-3xl break-words text-3xl font-black uppercase leading-tight sm:text-6xl">
                                {copy.loopHeadingLines.map((line) => (
                                    <span key={line} className="block">{line}</span>
                                ))}
                            </h2>
                        </div>
                        <p className="max-w-2xl text-base font-bold leading-relaxed text-slate-600 sm:text-lg lg:justify-self-end">
                            {copy.loopIntro}
                        </p>
                    </div>

                    <div className="mt-10 max-w-full overflow-hidden border-2 border-black bg-white shadow-neo sm:shadow-neo-lg lg:mt-14">
                        <div className="hidden bg-slate-950 text-white md:grid md:grid-cols-[285px_minmax(0,1fr)_minmax(280px,0.78fr)]">
                            <div className="border-b-2 border-black px-4 py-3 text-[11px] font-black uppercase md:border-b-0 md:border-r-2">
                                {copy.tableStep}
                            </div>
                            <div className="border-b-2 border-black px-4 py-3 text-[11px] font-black uppercase md:border-b-0 md:border-r-2">
                                {copy.tableCatches}
                            </div>
                            <div className="px-4 py-3 text-[11px] font-black uppercase">{copy.tableNext}</div>
                        </div>
                        {renderedSteps.map((step) => {
                            const Icon = step.icon;
                            return (
                                <article
                                    key={step.label}
                                    className="grid border-t-2 border-black first:border-t-0 md:grid-cols-[285px_minmax(0,1fr)_minmax(280px,0.78fr)] md:first:border-t-2"
                                >
                                    <div className={`flex items-center gap-3 border-b-2 border-black px-4 py-5 md:border-b-0 md:border-r-2 ${step.strip}`}>
                                        <div className={`grid h-11 w-11 shrink-0 place-items-center border-2 border-black bg-white shadow-neo-sm ${step.tone}`}>
                                            <Icon size={20} strokeWidth={2.8} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black uppercase text-black/65">{copy.loopStage}</p>
                                            <h3 className="whitespace-nowrap text-lg font-black uppercase leading-tight text-black min-[380px]:text-xl">{step.label}</h3>
                                        </div>
                                    </div>
                                    <div className="border-b-2 border-black px-4 py-5 md:border-b-0 md:border-r-2 sm:px-6">
                                        <p className="mb-2 text-[10px] font-black uppercase text-[#2563eb] md:hidden">{copy.tableCatches}</p>
                                        <h3 className="text-xl font-black leading-tight">{step.title}</h3>
                                        <p className="mt-2 text-sm font-bold leading-relaxed text-slate-600">{step.signal}</p>
                                    </div>
                                    <div className="bg-[#f8fafc] px-4 py-5 sm:px-6">
                                        <p className="mb-2 text-[10px] font-black uppercase text-[#2563eb] md:hidden">{copy.tableNext}</p>
                                        <div className="flex min-w-0 items-start gap-3 md:items-center">
                                            <ArrowRight className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb] md:mt-0" strokeWidth={3} />
                                            <p className="min-w-0 flex-1 text-sm font-black leading-relaxed text-slate-800">{step.move}</p>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
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
                        {renderedStories.map((story, index) => {
                            const Icon = story.icon;
                            const imageOrder = index % 2 === 1 ? 'lg:order-last' : '';

                            return (
                                <article
                                    key={story.title}
                                    className="grid overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-2"
                                >
                                    <div className={`min-h-[220px] border-b border-slate-200 bg-white p-2 sm:min-h-[260px] sm:p-3 lg:min-h-[420px] lg:border-b-0 ${index % 2 === 1 ? 'lg:border-l' : 'lg:border-r'} ${imageOrder}`}>
                                        <div className={`flex h-full items-center rounded-md ${story.accent} p-3`}>
                                            <img
                                                src={story.image}
                                                alt={story.alt}
                                                className="h-full max-h-[390px] w-full rounded-md border border-white/70 object-cover object-left-top shadow-[0_18px_36px_rgba(15,23,42,0.16)]"
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex min-w-0 flex-col justify-center p-5 sm:p-8 lg:p-12">
                                        <div className={`mb-6 grid h-12 w-12 place-items-center rounded-lg ${story.accent}`}>
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

            <section className="w-full border-y border-slate-200 bg-white px-4 py-14 text-slate-950 sm:px-6 sm:py-24 lg:px-8">
                <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
                    <div className="min-w-0 lg:sticky lg:top-24">
                        <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">{copy.trustEyebrow}</p>
                        <h2 className="break-words text-3xl font-black uppercase leading-tight tracking-tight sm:text-6xl">
                            {copy.trustHeading}
                        </h2>
                        <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-slate-600">
                            {copy.trustCopy}
                        </p>

                        <div className="mt-7 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase shadow-sm">
                                <MarkExpo className="h-4 w-4" />
                                Expo
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase shadow-sm">
                                <MarkReactNative className="h-4 w-4 text-[#2563eb]" />
                                React Native
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase shadow-sm">
                                <MarkSwift className="h-4 w-4 text-[#f97316]" />
                                Swift
                            </span>
                        </div>
                    </div>

                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                        {renderedTrustCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <article
                                    key={card.title}
                                    className={`rounded-lg border border-slate-200 p-5 shadow-sm ${card.className}`}
                                >
                                    <div className="mb-5 flex items-center gap-3">
                                        {card.flag && <EuFlag className="h-8 w-12 shrink-0 shadow-sm" />}
                                        {Icon && (
                                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[#2563eb] shadow-sm">
                                                <Icon className="h-5 w-5" strokeWidth={2.7} />
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="text-lg font-black uppercase">{card.title}</h3>
                                    <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">{card.copy}</p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="w-full bg-[#e8f4ff] px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
                <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
                    <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                        <div className="text-3xl font-black leading-none sm:text-5xl">{copy.stats.cheaper}</div>
                        <div className="mt-3 max-w-xl text-[12px] font-black uppercase leading-relaxed text-slate-500">
                            {copy.stats.cheaperCopy}
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                        <div className="text-3xl font-black leading-none sm:text-4xl">{copy.stats.freeSessions}</div>
                        <div className="mt-3 text-[11px] font-black uppercase text-slate-500">{copy.stats.everyMonth}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                        <div className="text-3xl font-black leading-none">{copy.stats.allFeatures}</div>
                        <div className="mt-3 text-[11px] font-black uppercase text-slate-500">{copy.stats.allFeaturesCopy}</div>
                    </div>
                </div>
            </section>
        </div>
    );
};
