import React from 'react';
import { Link } from 'react-router';
import {
    ArrowRight,
    Bookmark,
    ChevronLeft,
    Coffee,
    MapPin,
    Navigation,
    Search,
    Server,
    ShoppingBag,
    SlidersHorizontal,
    Zap,
} from 'lucide-react';
import type { MarketingLocale } from '~/shared/lib/internationalMarketing';

const PhoneCursor: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 16 20" fill="none" className={className}>
        <path d="M0 0 L0 16 L4.5 12 L7.5 18.5 L10 17.5 L7 11 L12 11 Z" fill="#5dadec" />
        <path d="M0 0 L0 16 L4.5 12 L7.5 18.5 L10 17.5 L7 11 L12 11 Z" stroke="#020617" strokeWidth="1" />
    </svg>
);

const IPhone: React.FC<{
    children: React.ReactNode;
    size: 'sm' | 'lg';
    darkStatus?: boolean;
    shadowClass: string;
    className?: string;
}> = ({ children, size, darkStatus = false, shadowClass, className = '' }) => {
    const isLg = size === 'lg';
    const width = isLg ? 'clamp(230px, 17.5vw, 258px)' : 'clamp(188px, 13.2vw, 204px)';
    const shellRadius = isLg ? 'rounded-[44px]' : 'rounded-[38px]';
    const screenRadius = isLg ? 'rounded-[38px]' : 'rounded-[32px]';
    const islandWidth = isLg ? 'w-[82px]' : 'w-[68px]';
    const islandHeight = isLg ? 'h-[24px]' : 'h-[20px]';
    const sideButtonHeight = isLg ? 'h-14' : 'h-11';

    return (
        <div className={`relative ${className}`} style={{ width }}>
            <div className="absolute -left-[3px] top-[18%] h-6 w-[3px] rounded-l-full bg-[#101216]" />
            <div className="absolute -left-[3px] top-[28%] h-10 w-[3px] rounded-l-full bg-[#101216]" />
            <div className="absolute -left-[3px] top-[39%] h-10 w-[3px] rounded-l-full bg-[#101216]" />
            <div className={`absolute -right-[3px] top-[32%] w-[3px] rounded-r-full bg-[#101216] ${sideButtonHeight}`} />

            <div className={`relative overflow-hidden border border-black/80 bg-[#07090d] p-[4px] ${shellRadius} ${shadowClass}`}>
                <div className="pointer-events-none absolute inset-[2px] rounded-[inherit] border border-white/10" />

                <div
                    className={`relative overflow-hidden bg-[#f8fafc] ${screenRadius}`}
                    style={{ aspectRatio: '9 / 19.5' }}
                >
                    <div className={`pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-5 pt-[12px] font-mono text-[8px] font-black ${darkStatus ? 'text-white' : 'text-slate-900'}`}>
                        <span>9:41</span>
                        <div className="flex items-center gap-1 pt-[2px]">
                            <span className={`h-[5px] w-[13px] rounded-[2px] border ${darkStatus ? 'border-white' : 'border-black'}`}>
                                <span className={`block h-full w-[9px] ${darkStatus ? 'bg-white' : 'bg-black'}`} />
                            </span>
                        </div>
                    </div>
                    <div className={`absolute left-1/2 top-[8px] z-30 -translate-x-1/2 ${islandWidth} ${islandHeight} rounded-full bg-black shadow-[0_1px_6px_rgba(0,0,0,0.22)]`}>
                        <span className="absolute right-2.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#111827]" />
                    </div>
                    {children}
                    <div className={`absolute bottom-[8px] left-1/2 h-[3px] w-20 -translate-x-1/2 rounded-full ${darkStatus ? 'bg-white/45' : 'bg-black/25'}`} />
                    <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(120deg,rgba(255,255,255,0.14),transparent_34%,transparent_72%,rgba(255,255,255,0.08))]" />
                </div>
            </div>
        </div>
    );
};

type TouchTone = 'blue' | 'rose' | 'amber' | 'green';

const touchGradients: Record<TouchTone, string> = {
    blue: 'radial-gradient(circle, rgba(93,173,236,0.92) 0%, rgba(93,173,236,0.38) 34%, transparent 72%)',
    rose: 'radial-gradient(circle, rgba(244,63,94,0.95) 0%, rgba(251,113,133,0.58) 30%, rgba(251,113,133,0.18) 54%, transparent 78%)',
    amber: 'radial-gradient(circle, rgba(251,191,36,0.95) 0%, rgba(251,191,36,0.44) 34%, transparent 72%)',
    green: 'radial-gradient(circle, rgba(16,185,129,0.92) 0%, rgba(52,211,153,0.42) 36%, transparent 74%)',
};

const TouchPulse: React.FC<{
    top: string;
    left: string;
    size: number;
    tone?: TouchTone;
    className?: string;
}> = ({ top, left, size, tone = 'blue', className = '' }) => (
    <div
        className={`pointer-events-none absolute rounded-full blur-[1px] ${className}`}
        style={{
            top,
            left,
            width: size,
            height: size,
            transform: 'translate(-50%, -50%)',
            background: touchGradients[tone],
        }}
    />
);

const MountainScene: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`relative overflow-hidden bg-[linear-gradient(180deg,#d9f4ff_0%,#9bd5f3_42%,#437fa7_100%)] ${className}`}>
        <div className="absolute left-8 top-8 h-20 w-20 rounded-full bg-amber-100/75 blur-xl" />
        <svg viewBox="0 0 220 210" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
            <path d="M-24 142 C28 103 63 98 105 120 C146 142 164 83 246 94 L246 220 L-24 220 Z" fill="#a7d5ee" opacity="0.66" />
            <path d="M-8 160 L39 113 L67 132 L112 50 L154 117 L181 91 L232 164 L232 220 L-8 220 Z" fill="#236e9b" />
            <path d="M112 50 L132 82 L119 76 L141 116 L112 96 L82 149 Z" fill="#f8fbff" />
            <path d="M39 113 L55 128 L48 126 L67 132 L55 146 L11 167 Z" fill="#eaf7ff" opacity="0.78" />
            <path d="M181 91 L198 114 L189 111 L211 146 L180 128 L151 171 Z" fill="#eefaff" opacity="0.8" />
            <path d="M-20 180 C22 157 49 159 84 174 C122 190 160 148 238 158 L238 220 L-20 220 Z" fill="#0f4267" />
            <path d="M-5 153 C36 139 64 149 101 134 C137 118 164 125 228 103" stroke="rgba(255,255,255,0.28)" strokeWidth="5" strokeLinecap="round" />
            <path d="M102 170 C117 146 133 129 155 111" stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 6" />
            <circle cx="103" cy="170" r="4" fill="#34d399" />
            <circle cx="155" cy="111" r="4" fill="#f97316" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/62 to-transparent" />
    </div>
);

const OutdoorClientApp: React.FC = () => (
    <div className="relative h-full overflow-hidden bg-[#f4f7ef] px-3.5 pb-8 pt-12 text-slate-950">
        <div className="flex items-center justify-between">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm">
                <ChevronLeft size={17} strokeWidth={3} />
            </button>
            <div className="text-center">
                <div className="text-[7px] font-black uppercase text-slate-400">Ridgeline</div>
                <div className="text-[14px] font-black">Saturday climb</div>
            </div>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm">
                <Bookmark size={15} strokeWidth={2.6} />
            </button>
        </div>

        <div className="relative mt-4 h-[220px] overflow-hidden rounded-[20px] shadow-[0_20px_38px_rgba(15,23,42,0.18)]">
            <MountainScene className="h-full w-full" />
            <div className="absolute left-3 top-3 rounded-[10px] bg-white/86 px-2.5 py-1.5 text-[8px] font-black uppercase text-slate-950 shadow-sm backdrop-blur">
                Open trail
            </div>
            <div className="absolute bottom-3 left-3 right-3 rounded-[16px] bg-slate-950/74 p-3.5 text-white backdrop-blur">
                <div className="text-[19px] font-black leading-none">Cinder Ridge</div>
                <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-white/76">
                    <span className="flex items-center gap-1">
                        <MapPin size={10} strokeWidth={3} />
                        West face
                    </span>
                    <span>1,240 ft gain</span>
                </div>
            </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
            {[
                ['8.2 mi', 'Trail'],
                ['6:30', 'Start'],
                ['41 F', 'Weather'],
            ].map(([value, label]) => (
                <div key={label} className="rounded-[12px] bg-white px-2 py-2 shadow-sm">
                    <div className="text-[12px] font-black leading-none">{value}</div>
                    <div className="mt-1 text-[6px] font-black uppercase text-slate-400">{label}</div>
                </div>
            ))}
        </div>

        <div className="mt-3 rounded-[17px] bg-white p-3.5 shadow-[0_12px_24px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-[13px] font-black leading-tight">Trail kit</div>
                    <div className="mt-1 text-[8px] font-bold text-slate-400">Packed for the route</div>
                </div>
                <span className="rounded-[10px] bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">
                    Ready
                </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
                {['Water', 'Shell', 'Permit'].map((item, index) => (
                    <div
                        key={item}
                        className={`rounded-[11px] px-2 py-2 text-center text-[8px] font-black ${index === 2 ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                        {item}
                    </div>
                ))}
            </div>
        </div>

        <button type="button" className="absolute bottom-10 left-4 right-4 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-slate-950 text-[10px] font-black uppercase text-white shadow-[0_12px_20px_rgba(15,23,42,0.18)]">
            <Zap size={13} fill="currentColor" />
            Start route
        </button>

        <TouchPulse top="46%" left="64%" size={62} tone="green" />
        <TouchPulse top="87%" left="56%" size={54} tone="blue" />
        <div className="pointer-events-none absolute right-[30%] top-[47%]">
            <PhoneCursor className="h-5 w-4 drop-shadow-[0_0_8px_rgba(16,185,129,0.72)]" />
        </div>
    </div>
);

const RetailClientApp: React.FC = () => (
    <div className="relative h-full overflow-hidden bg-[#f7f2ea] px-3 pb-8 pt-12 text-slate-950">
        <div className="flex items-center justify-between">
            <div>
                <div className="text-[18px] font-black leading-none">Vela</div>
                <div className="mt-1 text-[7px] font-black uppercase text-slate-400">New outerwear</div>
            </div>
            <button type="button" className="relative grid h-9 w-9 place-items-center rounded-[10px] bg-slate-950 text-white">
                <ShoppingBag size={15} strokeWidth={2.5} />
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-[#5dadec] text-[7px] font-black text-slate-950">2</span>
            </button>
        </div>

        <div className="relative mt-3 flex h-10 items-center gap-2 rounded-[13px] bg-white px-3 shadow-sm">
            <Search size={15} className="text-slate-300" strokeWidth={3} />
            <span className="flex-1 text-[10px] font-black text-slate-400">Search shells, packs</span>
            <SlidersHorizontal size={14} className="text-slate-400" strokeWidth={2.5} />
        </div>

        <div className="mt-3 flex gap-2">
            {['Shells', 'Trail', 'Sale'].map((item, index) => (
                <span
                    key={item}
                    className={`rounded-[10px] px-2.5 py-1.5 text-[8px] font-black ${index === 0 ? 'bg-slate-950 text-white' : 'bg-white text-slate-500 shadow-sm'}`}
                >
                    {item}
                </span>
            ))}
        </div>

        <div className="relative mt-3 overflow-hidden rounded-[18px] bg-[#15191f] p-3 text-white shadow-[0_18px_30px_rgba(15,23,42,0.18)]">
            <div className="relative h-[126px] rounded-[15px] bg-[#d8eef8]">
                <div className="absolute left-[18%] top-4 h-20 w-16 rounded-[18px] bg-white/48 blur-lg" />
                <div className="absolute left-1/2 top-3 h-[100px] w-[70px] -translate-x-1/2 rounded-t-[34px] rounded-b-[15px] bg-[#69c7ee] shadow-[inset_0_-14px_22px_rgba(14,116,144,0.2)]" />
                <div className="absolute left-[31%] top-12 h-12 w-5 rotate-[-18deg] rounded-full bg-[#38bdf8]/70" />
                <div className="absolute right-[31%] top-12 h-12 w-5 rotate-[18deg] rounded-full bg-[#38bdf8]/70" />
                <div className="absolute bottom-3 left-1/2 h-6 w-12 -translate-x-1/2 rounded-[9px] bg-slate-950/20" />
            </div>
            <div className="mt-3 flex items-start justify-between gap-3">
                <div>
                    <div className="text-[14px] font-black leading-none">Aero shell</div>
                    <div className="mt-1 text-[8px] font-bold text-white/58">Waterproof layer</div>
                </div>
                <div className="text-[15px] font-black">$148</div>
            </div>
            <div className="mt-3 flex items-center gap-2">
                {['XS', 'S', 'M', 'L'].map((size, index) => (
                    <span
                        key={size}
                        className={`grid h-7 flex-1 place-items-center rounded-[9px] text-[9px] font-black ${index === 0 ? 'bg-white/10 text-white/42' : index === 2 ? 'bg-white text-slate-950' : 'bg-white/12 text-white/70'}`}
                    >
                        {size}
                    </span>
                ))}
            </div>
        </div>

        <button type="button" className="absolute bottom-10 left-4 right-4 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-slate-950 text-[10px] font-black uppercase text-white shadow-[0_12px_20px_rgba(15,23,42,0.18)]">
            Add to bag
            <ShoppingBag size={13} strokeWidth={3} />
        </button>

        <TouchPulse top="62%" left="56%" size={52} tone="rose" />
        <TouchPulse top="87%" left="55%" size={50} tone="green" />
        <div className="pointer-events-none absolute left-[58%] top-[63%]">
            <PhoneCursor className="h-5 w-4 drop-shadow-[0_0_8px_rgba(244,63,94,0.72)]" />
        </div>
    </div>
);

const CafeClientApp: React.FC = () => (
    <div className="relative h-full overflow-hidden bg-[#f8faf9] px-3 pb-8 pt-12 text-slate-950">
        <div className="flex items-center justify-between">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-[10px] bg-white shadow-sm">
                <ChevronLeft size={17} strokeWidth={3} />
            </button>
            <div className="flex items-center gap-2 rounded-[12px] bg-white px-3 py-2 shadow-sm">
                <Coffee size={14} strokeWidth={2.8} />
                <span className="text-[11px] font-black">Morning pickup</span>
            </div>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-[10px] bg-slate-950 text-white">
                <Navigation size={14} strokeWidth={2.8} />
            </button>
        </div>

        <div className="relative mt-4 h-[160px] overflow-hidden rounded-[18px] bg-[#e8f4ef] shadow-[0_18px_32px_rgba(15,23,42,0.12)]">
            <svg viewBox="0 0 220 170" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
                <rect width="220" height="170" fill="#e8f4ef" />
                <path d="M-18 160 C27 132 52 133 84 105 C125 69 156 73 238 34" stroke="white" strokeWidth="18" strokeLinecap="round" />
                <path d="M30 -14 C40 43 42 82 72 113 C101 143 127 159 147 232" stroke="white" strokeWidth="16" strokeLinecap="round" />
                <path d="M-18 54 L244 147" stroke="white" strokeWidth="13" strokeLinecap="round" />
                <path d="M-18 160 C27 132 52 133 84 105 C125 69 156 73 238 34" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 9" />
                <path d="M30 -14 C40 43 42 82 72 113 C101 143 127 159 147 232" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 9" />
                <path d="M-18 54 L244 147" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeDasharray="7 9" />
            </svg>
            <div className="absolute left-[29%] top-[44%] grid h-8 w-8 place-items-center rounded-[10px] bg-slate-950 text-white shadow-lg">
                <Coffee size={15} strokeWidth={3} />
            </div>
            <div className="absolute right-[22%] top-[28%] grid h-7 w-7 place-items-center rounded-[10px] bg-white text-slate-950 shadow-md">
                <Coffee size={13} strokeWidth={3} />
            </div>
        </div>

        <div className="mt-3 rounded-[17px] bg-white p-3 shadow-[0_16px_28px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <div className="text-[13px] font-black leading-tight">Loop Cafe</div>
                    <div className="mt-1 flex items-center gap-1 text-[8px] font-bold text-slate-400">
                        <MapPin size={10} strokeWidth={3} />
                        Fulton Market
                    </div>
                </div>
                <div className="rounded-[9px] bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-600">Open</div>
            </div>
            <div className="mt-3 flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-[12px] bg-[#f3e5d8]">
                    <Coffee size={16} strokeWidth={2.8} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-black">Honey oat latte</div>
                    <div className="text-[8px] font-black text-slate-400">$5.80</div>
                </div>
            </div>
        </div>

        <button type="button" className="absolute bottom-10 left-4 right-4 flex h-11 items-center justify-center gap-2 rounded-[14px] bg-slate-950 text-[10px] font-black uppercase text-white shadow-[0_12px_20px_rgba(15,23,42,0.18)]">
            Order ahead
        </button>

        <TouchPulse top="49%" left="31%" size={54} tone="blue" />
        <TouchPulse top="87%" left="56%" size={50} tone="rose" />
        <div className="pointer-events-none absolute right-[36%] bottom-[54px]">
            <PhoneCursor className="h-5 w-4 drop-shadow-[0_0_8px_rgba(244,63,94,0.72)]" />
        </div>
    </div>
);

type HeroCopy = MarketingLocale['hero'];

export const Hero: React.FC<{ copy: HeroCopy; dir?: 'ltr' | 'rtl' }> = ({ copy, dir = 'ltr' }) => {
    const alignClass = dir === 'rtl' ? 'text-right' : 'text-left';

    return (
        <section
            aria-label="Hero section"
            className="relative w-full overflow-hidden border-b-2 border-black bg-[#f8fafc] px-4 pb-16 pt-16 text-black sm:px-6 sm:pb-20 sm:pt-24 lg:px-8 lg:pb-28 lg:pt-28"
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#000_1px,transparent_1px),linear-gradient(90deg,#000_1px,transparent_1px)] [background-size:32px_32px]"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -left-20 bottom-10 hidden h-40 w-80 rotate-[7deg] border-2 border-black bg-[#fef08a] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] lg:block"
                aria-hidden
            />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(520px,1fr)] lg:gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(640px,1fr)] xl:gap-10">

                    {/* Left - copy */}
                    <div className={`relative min-w-0 space-y-7 ${alignClass}`} dir={dir}>


                        <h1 className="max-w-4xl text-black">
                            <span className="block max-w-full break-words text-[2.65rem] font-black uppercase leading-[0.92] tracking-tight min-[380px]:text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                                {copy.headlinePrimary}
                            </span>
                            <span className="mt-3 block max-w-full break-words font-mono text-3xl font-black uppercase leading-[0.96] tracking-[0.06em] text-[#5dadec] min-[380px]:text-4xl sm:mt-3 sm:text-5xl sm:tracking-[0.1em] md:text-6xl lg:mt-4 lg:text-7xl">
                                {copy.headlineSecondary}
                            </span>
                        </h1>

                        <p className="max-w-full text-base font-extrabold leading-relaxed text-slate-700 sm:max-w-2xl sm:text-lg">
                            See what users actually did inside your mobile app, why they got stuck, and which fixes will move retention, stability, and conversion.
                        </p>

                        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                            <Link
                                to="/login"
                                className="animate-fade-in-up inline-flex w-full items-center justify-center gap-3 border-2 border-black bg-black px-6 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-[6px_6px_0px_0px_rgba(93,173,236,1)] opacity-0 transition-all hover:-translate-y-0.5 hover:bg-[#5dadec] hover:text-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:w-auto sm:px-8"
                                style={{ animationDelay: '0.48s' }}
                            >
                                {copy.primaryCta}
                                <ArrowRight size={18} strokeWidth={3} />
                            </Link>
                            <Link
                                to="/docs#self-hosting"
                                className="animate-fade-in-up inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-widest text-black underline underline-offset-4 opacity-0 transition-colors hover:text-slate-500"
                                style={{ animationDelay: '0.56s' }}
                            >
                                <Server size={14} strokeWidth={3} />
                                {copy.secondaryCta}
                            </Link>
                        </div>

                        <div className="public-visual-copy flex justify-center pt-2 lg:hidden">
                            <div className="-rotate-[3deg]">
                                <IPhone size="sm" shadowClass="shadow-[0_24px_52px_rgba(15,23,42,0.2)]">
                                    <CafeClientApp />
                                </IPhone>
                            </div>
                        </div>
                    </div>

                    {/* Right - phones */}
                    <div
                        className="public-visual-copy relative hidden animate-fade-in-right opacity-0 lg:flex lg:items-end lg:justify-end"
                        style={{ animationDelay: '0.2s' }}
                    >
                        <div className="relative h-[610px] w-[760px] origin-right scale-[0.7] xl:scale-[0.84] 2xl:scale-[0.94]">
                            <div className="absolute bottom-[88px] left-[9%] right-[9%] h-px bg-gradient-to-r from-transparent via-black/18 to-transparent" />
                            <div className="relative z-10 flex h-full items-end justify-center gap-7 xl:gap-8">
                                <div className="relative z-10 mb-5 -rotate-[5deg] translate-y-1 transform-gpu">
                                    <IPhone size="sm" shadowClass="shadow-[0_24px_52px_rgba(15,23,42,0.2)]">
                                        <RetailClientApp />
                                    </IPhone>
                                </div>

                                <div className="relative z-30 -translate-y-3 transform-gpu">
                                    <IPhone size="lg" shadowClass="shadow-[0_34px_78px_rgba(15,23,42,0.28)]">
                                        <OutdoorClientApp />
                                    </IPhone>
                                </div>

                                <div className="relative z-20 mb-8 rotate-[5deg] transform-gpu">
                                    <IPhone size="sm" shadowClass="shadow-[0_24px_52px_rgba(15,23,42,0.2)]">
                                        <CafeClientApp />
                                    </IPhone>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};
