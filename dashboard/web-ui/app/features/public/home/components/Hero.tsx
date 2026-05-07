import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, Server, Terminal } from 'lucide-react';

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
    const width = isLg ? 'clamp(214px, 17vw, 242px)' : 'clamp(168px, 12.5vw, 188px)';
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

const MapHeatBlob: React.FC<{
    top: string;
    left: string;
    size: number;
    intensity?: 'high' | 'medium' | 'low';
}> = ({ top, left, size, intensity = 'medium' }) => {
    const gradient = intensity === 'high'
        ? 'radial-gradient(circle, rgba(251,113,133,0.98) 0%, rgba(249,168,212,0.9) 20%, rgba(196,181,253,0.72) 42%, rgba(34,211,238,0.42) 66%, transparent 100%)'
        : intensity === 'medium'
        ? 'radial-gradient(circle, rgba(249,168,212,0.88) 0%, rgba(196,181,253,0.72) 34%, rgba(34,211,238,0.45) 62%, transparent 100%)'
        : 'radial-gradient(circle, rgba(34,211,238,0.72) 0%, rgba(34,211,238,0.34) 54%, transparent 100%)';

    return (
        <div
            className="absolute rounded-full"
            style={{
                top,
                left,
                width: size,
                height: size,
                transform: 'translate(-50%, -50%)',
                background: gradient,
                filter: 'blur(12px)',
            }}
        />
    );
};

const ShoppingReplayScreen: React.FC = () => (
    <div className="relative h-full overflow-hidden bg-[#fbfbf7] px-3 pb-8 pt-12 text-slate-950">
        <div className="flex items-center justify-between">
            <div className="text-[15px] font-black leading-none">Northstar</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-[9px] font-black text-white">3</div>
        </div>

        <div className="mt-4 rounded-[24px] bg-[#e8f1ff] p-3 shadow-[0_14px_30px_rgba(15,23,42,0.10)]">
            <div className="mb-3 flex items-center justify-between">
                <div>
                    <div className="font-mono text-[7px] font-black uppercase tracking-[0.18em] text-slate-500">New drop</div>
                    <div className="text-[16px] font-black leading-none">City Backpack</div>
                </div>
                <div className="shrink-0 rounded-full bg-white/75 px-2 py-1 font-mono text-[10px] font-black">$128</div>
            </div>
            <div className="relative h-28 rounded-[22px] bg-[linear-gradient(145deg,#ffffff,#bfdbfe)]">
                <div className="absolute left-1/2 top-5 h-20 w-16 -translate-x-1/2 rounded-t-[28px] rounded-b-[16px] bg-[#5dadec]/70 shadow-inner" />
                <div className="absolute left-10 top-12 h-9 w-5 rotate-[-18deg] rounded-full bg-[#5dadec]/60" />
                <div className="absolute right-10 top-12 h-9 w-5 rotate-[18deg] rounded-full bg-[#5dadec]/60" />
            </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
            {[
                ['Trail cap', '$34', 'bg-[#dcfce7]'],
                ['Run socks', '$18', 'bg-[#fee2e2]'],
            ].map(([name, price, tone]) => (
                <div key={name} className="rounded-[20px] bg-white p-2 shadow-[0_10px_22px_rgba(15,23,42,0.07)]">
                    <div className={`mb-2 h-14 rounded-[16px] ${tone}`} />
                    <div className="truncate text-[8px] font-black">{name}</div>
                    <div className="font-mono text-[8px] font-black text-slate-500">{price}</div>
                </div>
            ))}
        </div>

        <div className="absolute bottom-9 left-3 right-3 rounded-[24px] bg-white p-3 shadow-[0_18px_36px_rgba(15,23,42,0.15)]">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-black">Cart total</span>
                <span className="font-mono text-[12px] font-black">$180</span>
            </div>
            <button type="button" className="h-10 w-full rounded-[18px] bg-slate-950 text-[9px] font-black uppercase tracking-widest text-white">
                Checkout
            </button>
            <div className="absolute left-[70%] top-[68%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#5dadec]/70 bg-[#5dadec]/15" />
            <div className="absolute left-[70%] top-[68%]">
                <PhoneCursor className="h-5 w-4 drop-shadow-[0_0_8px_rgba(93,173,236,0.75)]" />
            </div>
        </div>
    </div>
);

const HeatmapScreen: React.FC = () => (
    <div className="relative h-full overflow-hidden bg-[#eef6ff] text-slate-950">
        <svg viewBox="0 0 220 478" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
            <rect width="220" height="478" fill="#eef6ff" />
            <path d="M-36 365 C14 326 45 310 80 260 C116 209 139 184 256 128 L256 478 L-36 478 Z" fill="#dcfce7" />
            <path d="M-22 94 C21 120 56 111 94 79 C141 39 184 56 238 24" stroke="#bfdbfe" strokeWidth="24" strokeLinecap="round" />
            <path d="M-18 98 C24 121 58 113 96 82 C141 43 185 60 238 28" stroke="#dbeafe" strokeWidth="12" strokeLinecap="round" />
            <path d="M10 438 C39 382 75 350 105 300 C141 241 158 158 207 84" stroke="white" strokeWidth="17" strokeLinecap="round" />
            <path d="M10 438 C39 382 75 350 105 300 C141 241 158 158 207 84" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 11" />
            <path d="M-20 205 L238 273" stroke="white" strokeWidth="18" strokeLinecap="round" />
            <path d="M-20 205 L238 273" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="9 11" />
            <path d="M79 -20 C86 64 88 129 102 193 C122 282 146 325 156 500" stroke="white" strokeWidth="16" strokeLinecap="round" />
            <path d="M79 -20 C86 64 88 129 102 193 C122 282 146 325 156 500" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 11" />
            <path d="M25 287 C58 261 77 238 96 202 C124 148 150 113 199 91" stroke="white" strokeWidth="13" strokeLinecap="round" />
            <path d="M25 287 C58 261 77 238 96 202 C124 148 150 113 199 91" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="7 9" />
            <circle cx="61" cy="374" r="5" fill="#0f172a" />
            <circle cx="165" cy="147" r="5" fill="#0f172a" />
            <circle cx="132" cy="265" r="5" fill="#0f172a" />
        </svg>
        <MapHeatBlob top="37%" left="70%" size={142} intensity="high" />
        <MapHeatBlob top="57%" left="55%" size={162} intensity="medium" />
        <MapHeatBlob top="76%" left="32%" size={118} intensity="low" />

        <div className="absolute left-4 right-4 top-14 rounded-full bg-white/92 px-4 py-3 shadow-[0_12px_24px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="font-mono text-[7px] font-black uppercase tracking-[0.18em] text-slate-500">Search nearby</div>
            <div className="text-[12px] font-black">Coffee near Fulton Market</div>
        </div>

        <div className="absolute right-4 top-32 space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[15px] font-black shadow-sm">+</div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[15px] font-black shadow-sm">-</div>
        </div>

        <div className="absolute bottom-9 left-4 right-4 rounded-[26px] bg-white/94 p-3 shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur">
            <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                    <div className="text-[13px] font-black leading-tight">The Loop Coffee</div>
                    <div className="text-[8px] font-bold text-slate-500">8 min walk · 0.4 mi</div>
                </div>
                <div className="rounded-full bg-slate-950 px-2 py-1 font-mono text-[8px] font-black text-white">4.8</div>
            </div>
            <div className="flex gap-1">
                {['Open', 'Popular', 'Pickup'].map((label) => (
                    <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-[7px] font-black text-slate-700">
                        {label}
                    </span>
                ))}
            </div>
        </div>
    </div>
);

const RideSearchScreen: React.FC = () => (
    <div className="relative h-full overflow-hidden bg-[#f7f9fb] px-3 pb-8 pt-12 text-slate-950">
        <div className="flex items-center justify-between">
            <div>
                <div className="font-mono text-[7px] font-black uppercase tracking-[0.18em] text-slate-500">CityRide</div>
                <div className="text-[15px] font-black leading-none">Book a ride</div>
            </div>
            <div className="h-8 w-8 rounded-full bg-[#dcfce7]" />
        </div>

        <div className="mt-4 rounded-[24px] bg-white p-3 shadow-[0_14px_30px_rgba(15,23,42,0.10)]">
            <div className="mb-2 rounded-[16px] bg-slate-50 p-2">
                <div className="font-mono text-[6px] font-black uppercase tracking-[0.16em] text-slate-400">Pickup</div>
                <div className="text-[10px] font-black">West Loop Station</div>
            </div>
            <div className="rounded-[16px] bg-slate-50 p-2">
                <div className="font-mono text-[6px] font-black uppercase tracking-[0.16em] text-slate-400">Dropoff</div>
                <div className="text-[10px] font-black">River North</div>
            </div>
        </div>

        <div className="relative mt-3 h-40 overflow-hidden rounded-[26px] bg-[#eaf4ff] shadow-[0_14px_28px_rgba(15,23,42,0.08)]">
            <svg viewBox="0 0 170 160" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
                <rect width="170" height="160" fill="#eaf4ff" />
                <path d="M-13 112 C24 79 48 90 72 60 C94 33 126 35 188 15" stroke="white" strokeWidth="13" strokeLinecap="round" />
                <path d="M14 -8 C25 37 29 72 55 98 C79 123 103 134 125 173" stroke="white" strokeWidth="13" strokeLinecap="round" />
                <path d="M-8 42 L177 125" stroke="white" strokeWidth="11" strokeLinecap="round" />
                <circle cx="56" cy="82" r="6" fill="#5dadec" />
                <circle cx="120" cy="45" r="6" fill="#111827" />
            </svg>
            <div className="absolute bottom-3 left-3 rounded-full bg-white px-2.5 py-1.5 text-[8px] font-black shadow-sm">12 min</div>
        </div>

        <div className="mt-3 space-y-2">
            {[
                ['Standard', '$18', '2 min'],
                ['XL', '$26', '5 min'],
            ].map(([type, price, eta]) => (
                <div key={type} className="flex items-center justify-between rounded-[18px] bg-white px-3 py-2 shadow-sm">
                    <div>
                        <div className="text-[10px] font-black">{type}</div>
                        <div className="font-mono text-[7px] font-bold text-slate-500">{eta}</div>
                    </div>
                    <div className="font-mono text-[10px] font-black">{price}</div>
                </div>
            ))}
        </div>

        <button type="button" className="absolute bottom-9 left-3 right-3 h-11 rounded-[20px] bg-slate-950 text-[9px] font-black uppercase tracking-widest text-white">
            Confirm ride
        </button>
        <div className="pointer-events-none absolute bottom-[45px] left-1/2 h-14 w-14 -translate-x-1/2 translate-y-1 rounded-full bg-[radial-gradient(circle,rgba(251,113,133,0.9)_0%,rgba(249,168,212,0.72)_24%,rgba(196,181,253,0.54)_48%,rgba(34,211,238,0.28)_70%,transparent_100%)] blur-[2px]" />
        <div className="pointer-events-none absolute bottom-[54px] left-1/2 h-8 w-8 -translate-x-1/2 rounded-full border-2 border-rose-400/80 bg-rose-300/20" />
        <div className="pointer-events-none absolute bottom-[51px] left-[54%] h-6 w-6 -translate-x-1/2 rounded-full border-2 border-[#5dadec]/80 bg-[#5dadec]/15" />
        <div className="pointer-events-none absolute bottom-[71px] left-[63%] rounded-full bg-rose-500 px-1.5 py-0.5 font-mono text-[6px] font-black uppercase tracking-wider text-white shadow-sm">
            Rage tap
        </div>
        <div className="pointer-events-none absolute bottom-[55px] left-[55%]">
            <PhoneCursor className="h-5 w-4 drop-shadow-[0_0_8px_rgba(251,113,133,0.85)]" />
        </div>
    </div>
);

export const Hero: React.FC = () => {
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
                className="pointer-events-none absolute -left-20 bottom-10 h-40 w-80 rotate-[7deg] border-2 border-black bg-[#fef08a] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                aria-hidden
            />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.82fr] lg:gap-8">

                    {/* Left - copy */}
                    <div className="relative space-y-7">
                        <div className="inline-flex rotate-[-1deg] items-center gap-2 border-2 border-black bg-green-100 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-black shadow-neo-sm sm:text-xs">
                            <Terminal size={14} strokeWidth={3} />
                            Indie speed. Enterprise control.
                        </div>

                        <h1 className="max-w-4xl text-black">
                            <span
                                className="block animate-fade-in-up text-4xl font-black uppercase leading-[0.88] tracking-tight opacity-0 min-[380px]:text-5xl sm:text-6xl md:text-7xl lg:text-8xl"
                                style={{ animationDelay: '0.12s' }}
                            >
                                Creative analytics.
                            </span>
                            <span
                                data-text="Light SDK."
                                className="hero-kinetic-word animate-replay-scan-in mt-3 block font-mono text-3xl font-black uppercase leading-[0.92] tracking-[0.08em] text-[#5dadec] min-[380px]:text-4xl sm:mt-3 sm:text-5xl sm:tracking-[0.14em] md:text-6xl lg:mt-4 lg:text-7xl"
                                style={{ animationDelay: '0.2s' }}
                            >
                                Light SDK.
                            </span>
                        </h1>

                        <p
                            className="max-w-2xl animate-fade-in-up text-base font-extrabold leading-relaxed text-slate-700 opacity-0 sm:text-lg"
                            style={{ animationDelay: '0.36s' }}
                        >
                            Rejourney helps mobile teams understand every app session with replay,
                            crash reporting, touch heatmaps, user journeys, and product analytics
                            for mobile apps.
                        </p>

                        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
                            <Link
                                to="/login"
                                className="animate-fade-in-up inline-flex w-full items-center justify-center gap-3 border-2 border-black bg-black px-6 py-4 text-center text-sm font-black uppercase tracking-widest text-white shadow-[6px_6px_0px_0px_rgba(93,173,236,1)] opacity-0 transition-all hover:-translate-y-0.5 hover:bg-[#5dadec] hover:text-black hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:w-auto sm:px-8"
                                style={{ animationDelay: '0.48s' }}
                            >
                                Get started free
                                <ArrowRight size={18} strokeWidth={3} />
                            </Link>
                            <Link
                                to="/docs#self-hosting"
                                className="animate-fade-in-up inline-flex items-center gap-1.5 text-sm font-black uppercase tracking-widest text-black underline underline-offset-4 opacity-0 transition-colors hover:text-slate-500"
                                style={{ animationDelay: '0.56s' }}
                            >
                                <Server size={14} strokeWidth={3} />
                                Self-host instead
                            </Link>
                        </div>
                    </div>

                    {/* Right - phones */}
                    <div
                        className="public-visual-copy relative hidden animate-fade-in-right opacity-0 lg:flex lg:items-end lg:justify-center"
                        style={{ animationDelay: '0.2s' }}
                    >
                        <div className="relative h-[536px] w-[560px] origin-center scale-[0.8] xl:scale-90 2xl:scale-100">
                            <div className="absolute bottom-14 left-0 z-10 -rotate-[4deg]">
                                <IPhone size="sm" shadowClass="shadow-[0_22px_46px_rgba(15,23,42,0.18)]">
                                    <RideSearchScreen />
                                </IPhone>
                            </div>

                            <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2">
                                <IPhone size="lg" shadowClass="shadow-[0_30px_70px_rgba(15,23,42,0.24)]">
                                    <HeatmapScreen />
                                </IPhone>
                            </div>

                            <div className="absolute bottom-10 right-0 z-20 rotate-[4deg]">
                                <IPhone size="sm" shadowClass="shadow-[0_22px_46px_rgba(15,23,42,0.18)]">
                                    <ShoppingReplayScreen />
                                </IPhone>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};
