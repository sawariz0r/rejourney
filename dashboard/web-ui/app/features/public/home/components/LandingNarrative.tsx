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

const EuFlag: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 32" className={className} role="img" aria-label="European Union flag">
        <rect width="48" height="32" rx="6" fill="#1d4ed8" />
        {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index / 12) * Math.PI * 2 - Math.PI / 2;
            const cx = 24 + Math.cos(angle) * 8.5;
            const cy = 16 + Math.sin(angle) * 8.5;
            return <circle key={index} cx={cx} cy={cy} r="1.2" fill="#fde047" />;
        })}
    </svg>
);

const journeySteps = [
    {
        label: 'Watch',
        title: 'Replay the exact mobile session',
        copy: 'See screens, taps, swipes, navigation, crashes, network context, and the moment users hesitate.',
        icon: Eye,
        tone: 'bg-[#dbeafe]',
    },
    {
        label: 'Understand',
        title: 'Find the friction pattern',
        copy: 'Heatmaps, journeys, rage taps, crash reports, and ANRs turn one weird session into a clear trend.',
        icon: MousePointerClick,
        tone: 'bg-[#ffe4e6]',
    },
    {
        label: 'Act',
        title: 'Ship the fix with confidence',
        copy: 'Give product, engineering, support, and growth the same evidence instead of arguing from dashboards.',
        icon: CheckCircle2,
        tone: 'bg-[#dcfce7]',
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

export const LandingNarrative: React.FC = () => {
    return (
        <>
            <section className="w-full border-b border-slate-200 bg-white px-4 py-14 text-slate-950 sm:px-6 sm:py-24 lg:px-8">
                <div className="mx-auto max-w-7xl">
                    <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
                        <div className="min-w-0">
                            <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">The mobile insight loop</p>
                            <h2 className="max-w-3xl break-words text-3xl font-black uppercase leading-tight tracking-tight sm:text-6xl">
                                Stop guessing why users leave.
                            </h2>
                        </div>
                        <p className="max-w-2xl text-base font-bold leading-relaxed text-slate-600 sm:text-lg lg:justify-self-end">
                            Rejourney is arranged around the way teams actually make product decisions: watch what happened, understand the pattern, and act before the next release repeats it.
                        </p>
                    </div>

                    <div className="mt-10 grid gap-4 md:grid-cols-3 lg:mt-14">
                        {journeySteps.map((step) => {
                            const Icon = step.icon;
                            return (
                                <article key={step.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className={`mb-5 grid h-12 w-12 place-items-center rounded-lg ${step.tone}`}>
                                        <Icon size={22} strokeWidth={2.7} />
                                    </div>
                                    <p className="mb-2 text-[11px] font-black uppercase text-slate-400">{step.label}</p>
                                    <h3 className="text-xl font-black leading-tight">{step.title}</h3>
                                    <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">{step.copy}</p>
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
                            <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">What you can see</p>
                            <h2 className="max-w-4xl break-words text-3xl font-black uppercase leading-tight tracking-tight sm:text-6xl">
                                The signals mobile teams need in one place.
                            </h2>
                        </div>
                        <Link
                            to="/demo"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-black uppercase text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 sm:w-auto"
                        >
                            See live demo
                            <ArrowRight size={17} strokeWidth={3} />
                        </Link>
                    </div>

                    <div className="space-y-5 lg:space-y-7">
                        {productStories.map((story, index) => {
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
                        <p className="mb-4 text-[11px] font-black uppercase text-[#2563eb]">Why teams say yes</p>
                        <h2 className="break-words text-3xl font-black uppercase leading-tight tracking-tight sm:text-6xl">
                            Evidence for every person in the room.
                        </h2>
                        <p className="mt-5 max-w-xl text-base font-bold leading-relaxed text-slate-600">
                            Adoption is easier when every team gets the same replay-backed source of truth, plus clear answers for performance, privacy, deployment, and mobile stack fit.
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
                        {trustCards.map((card) => {
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
                        <div className="text-3xl font-black leading-none sm:text-5xl">17x cheaper</div>
                        <div className="mt-3 max-w-xl text-[12px] font-black uppercase leading-relaxed text-slate-500">
                            Than some of the cheapest session replay and product analytics tools in the industry.
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                        <div className="text-3xl font-black leading-none">5k sessions</div>
                        <div className="mt-3 text-[11px] font-black uppercase text-slate-500">Free every month</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
                        <div className="text-3xl font-black leading-none">All features</div>
                        <div className="mt-3 text-[11px] font-black uppercase text-slate-500">Replay, heatmaps, crashes, journeys</div>
                    </div>
                </div>
            </section>
        </>
    );
};
