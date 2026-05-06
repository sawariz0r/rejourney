import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useToast } from '~/shared/providers/ToastContext';
import { api, type BillingPlan } from '~/shared/api/client';

const FALLBACK_PLANS: BillingPlan[] = [
    { name: 'free', displayName: 'Free', sessionLimit: 5000, videoRetentionTier: 1, videoRetentionDays: 7, videoRetentionLabel: '7 days', priceCents: 0 },
    { name: 'starter', displayName: 'Starter', sessionLimit: 25000, videoRetentionTier: 2, videoRetentionDays: 14, videoRetentionLabel: '14 days', priceCents: 500 },
    { name: 'growth', displayName: 'Growth', sessionLimit: 100000, videoRetentionTier: 3, videoRetentionDays: 30, videoRetentionLabel: '30 days', priceCents: 1500 },
    { name: 'pro', displayName: 'Pro', sessionLimit: 350000, videoRetentionTier: 4, videoRetentionDays: 60, videoRetentionLabel: '60 days', priceCents: 3500 },
];

const VOLUME_PRESETS = [
    { label: '5k', sessions: 5000 },
    { label: '25k', sessions: 25000 },
    { label: '100k', sessions: 100000 },
    { label: '350k', sessions: 350000 },
];

const FEATURES = [
    'Session Replay',
    'Crash & ANR Detection',
    'Journey Mapping',
    'Touch Heatmaps',
    'Live Incident Stream',
    'Stability Monitoring',
    'Retention Analytics',
    'Smart Alerts',
    'Unlimited Analytics',
    'Unlimited Events',
    'Unlimited Analytics Retention',
];

const sliderToSessions = (v: number) => Math.round(1000 * Math.pow(400, v / 100));
const sessionsToSlider = (sessions: number) =>
    Math.min(100, Math.max(0, Math.round((Math.log(sessions / 1000) / Math.log(400)) * 100)));

export const PricingTable: React.FC = () => {
    const { showToast } = useToast();
    const [availablePlans, setAvailablePlans] = useState<BillingPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sliderValue, setSliderValue] = useState(54);
    const [calcOpen, setCalcOpen] = useState(false);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const plans = await api.getAvailablePlans();
                if (plans && plans.length > 0) setAvailablePlans(plans);
            } catch {
                /* use fallback */
            } finally {
                setIsLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText('contact@rejourney.co');
        showToast('Email copied to clipboard!');
    };

    const formatNumber = (val: number) => new Intl.NumberFormat('en-US').format(val);

    const posthogCost = (sessions: number): number => {
        if (sessions <= 5000) return 0;
        const r = sessions - 5000;
        return (
            Math.min(r, 20000) * 0.00425 +
            Math.max(0, Math.min(r - 20000, 75000)) * 0.0025 +
            Math.max(0, Math.min(r - 95000, 250000)) * 0.00176 +
            Math.max(0, r - 345000) * 0.00176
        );
    };

    const rejourneyPlan = (sessions: number): { price: number; plan: string; isCustom: boolean } => {
        if (sessions <= 5000) return { price: 0, plan: 'Free', isCustom: false };
        if (sessions <= 25000) return { price: 5, plan: 'Starter', isCustom: false };
        if (sessions <= 100000) return { price: 15, plan: 'Growth', isCustom: false };
        if (sessions <= 350000) return { price: 35, plan: 'Pro', isCustom: false };
        return { price: 35, plan: 'Enterprise', isCustom: true };
    };

    const calcSessions = sliderToSessions(sliderValue);
    const phCost = posthogCost(calcSessions);
    const rjInfo = rejourneyPlan(calcSessions);
    const sliderStyle = { '--slider-fill': `${sliderValue}%` } as CSSProperties;
    const plans = availablePlans.length > 0 ? availablePlans : FALLBACK_PLANS;

    return (
        <section className="relative w-full border-t-2 border-black bg-[#f8fafc] text-black">
            <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="mb-16 text-center">
                    <h2 className="mb-3 text-5xl font-black uppercase tracking-tight sm:text-6xl">
                        17x cheaper.
                    </h2>
                    <p className="text-lg text-slate-600">
                        Start free. Scale by sessions. Every plan includes all features.
                    </p>
                </div>

                {/* Plan Cards */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {plans.map((plan) => {
                            const price = plan.priceCents / 100;
                            const isRecommended = plan.name === 'growth';

                            return (
                                <article
                                    key={plan.name}
                                    className={`relative flex flex-col rounded-none border-2 border-black bg-white p-5 shadow-neo-sm transition-all hover:-translate-y-0.5 hover:shadow-neo ${
                                        isRecommended ? 'ring-2 ring-[#5dadec] ring-offset-2' : ''
                                    }`}
                                >
                                    {isRecommended && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="border-2 border-black bg-[#5dadec] px-3 py-0.5 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                                Recommended
                                            </span>
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">{plan.displayName}</h3>
                                        <div className="mt-1 flex items-baseline gap-1">
                                            <span className="text-5xl font-black tracking-tighter">${price}</span>
                                            <span className="text-sm text-slate-400">/mo</span>
                                        </div>
                                    </div>

                                    <div className="mb-6 flex-grow space-y-2 border-t border-black/10 pt-4">
                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                            <Check className="h-3.5 w-3.5 shrink-0 stroke-[3px]" />
                                            <span>{formatNumber(plan.sessionLimit)} sessions / mo</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                            <Check className="h-3.5 w-3.5 shrink-0 stroke-[3px]" />
                                            <span>{plan.videoRetentionLabel} replay retention</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                            <Check className="h-3.5 w-3.5 shrink-0 stroke-[3px]" />
                                            <span>All features included</span>
                                        </div>
                                    </div>

                                    <Link
                                        to="/login"
                                        className={`block w-full border-2 border-black py-2.5 text-center text-sm font-black uppercase tracking-widest transition-all hover:-translate-y-0.5 ${
                                            isRecommended
                                                ? 'bg-black text-white hover:bg-[#5dadec] hover:text-black'
                                                : 'bg-white text-black hover:bg-black hover:text-white'
                                        }`}
                                    >
                                        {price === 0 ? 'Start free' : 'Get started'}
                                    </Link>
                                </article>
                            );
                        })}
                    </div>
                )}

                {/* What's included — compact */}
                <div className="mb-16 border-2 border-black/10 bg-white px-5 py-4">
                    <p className="mb-3 text-xs font-black uppercase tracking-widest text-slate-400">Every plan includes</p>
                    <div className="flex flex-wrap gap-x-5 gap-y-2">
                        {FEATURES.map((f) => (
                            <span key={f} className="flex items-center gap-1.5 text-sm text-slate-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-[#5dadec]" />
                                {f}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Price Calculator — collapsible */}
                <div className="mb-16 border-2 border-black bg-white shadow-neo-sm">
                    <button
                        type="button"
                        onClick={() => setCalcOpen((v) => !v)}
                        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#f8fafc]"
                    >
                        <div>
                            <span className="font-black uppercase tracking-tight">Compare costs</span>
                            <span className="ml-3 text-sm text-slate-500">vs PostHog — drag to estimate</span>
                        </div>
                        <ChevronDown
                            className={`h-5 w-5 text-slate-400 transition-transform ${calcOpen ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {calcOpen && (
                        <div className="border-t-2 border-black/10 p-5">
                            <div className="mb-4">
                                <div className="mb-1 flex items-baseline justify-between">
                                    <span className="text-xs uppercase tracking-widest text-slate-500">Sessions / month</span>
                                    <span className="text-2xl font-black tracking-tight">{formatNumber(calcSessions)}</span>
                                </div>
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={sliderValue}
                                    onChange={(e) => setSliderValue(Number(e.target.value))}
                                    className="pricing-range-slider"
                                    style={sliderStyle}
                                    aria-label="Monthly sessions"
                                />
                                <div className="mt-3 flex gap-2">
                                    {VOLUME_PRESETS.map((preset) => {
                                        const active = Math.abs(calcSessions - preset.sessions) / preset.sessions < 0.08;
                                        return (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => setSliderValue(sessionsToSlider(preset.sessions))}
                                                className={`border-2 border-black px-3 py-1.5 text-xs font-black uppercase tracking-widest transition-all ${
                                                    active ? 'bg-black text-white' : 'bg-white text-black hover:bg-[#f8fafc]'
                                                }`}
                                            >
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 divide-x-2 divide-black border-2 border-black">
                                <div className="p-4">
                                    <div className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">Rejourney</div>
                                    <div className="text-3xl font-black tracking-tight">${rjInfo.price}<span className="ml-1 text-sm font-normal text-slate-400">/mo</span></div>
                                    <div className="mt-1 text-xs text-slate-500">{rjInfo.plan} plan{rjInfo.isCustom ? ' (contact us)' : ''}</div>
                                </div>
                                <div className="p-4">
                                    <div className="mb-1 text-xs font-black uppercase tracking-widest text-slate-400">PostHog</div>
                                    <div className="text-3xl font-black tracking-tight">${phCost.toFixed(2)}<span className="ml-1 text-sm font-normal text-slate-400">/mo</span></div>
                                    <div className="mt-1 text-xs text-slate-500">Usage based</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer row — Self-hosted + Enterprise */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="border-2 border-black bg-white p-5 shadow-neo-sm">
                        <p className="mb-0.5 font-black uppercase tracking-tight">Self-Hosted</p>
                        <p className="mb-4 text-sm text-slate-500">Open source, Apache 2.0 / SSPL. Your data, your infrastructure.</p>
                        <a
                            href="https://github.com/rejourneyco/rejourney"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 border-2 border-black bg-black px-4 py-2 text-sm font-black uppercase text-white transition-all hover:bg-white hover:text-black"
                        >
                            Docker or K3s <ArrowRight className="h-4 w-4" />
                        </a>
                    </div>

                    <div className="border-2 border-black bg-white p-5 shadow-neo-sm">
                        <p className="mb-0.5 font-black uppercase tracking-tight">Enterprise</p>
                        <p className="mb-4 text-sm text-slate-500">Custom limits, extended retention, heavy discounts, priority support.</p>
                        <button
                            onClick={handleCopyEmail}
                            className="inline-flex items-center gap-2 border-2 border-black bg-black px-4 py-2 text-sm font-black uppercase text-white transition-all hover:bg-white hover:text-black"
                        >
                            Contact us <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

            </div>
        </section>
    );
};
