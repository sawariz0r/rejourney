import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, Server, Terminal } from 'lucide-react';

export const Hero: React.FC = () => {
    return (
        <section
            aria-label="Hero section"
            className="relative w-full overflow-hidden border-b-2 border-black bg-[#f8fafc] px-4 pb-12 pt-16 text-black sm:px-6 sm:pb-16 sm:pt-24 lg:px-8 lg:pb-20 lg:pt-24"
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#000_1px,transparent_1px),linear-gradient(90deg,#000_1px,transparent_1px)] [background-size:32px_32px]"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -right-28 top-20 h-56 w-[34rem] rotate-[-8deg] border-2 border-black bg-[#5dadec] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -left-20 bottom-10 h-40 w-80 rotate-[7deg] border-2 border-black bg-[#fef08a] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                aria-hidden
            />

            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.58fr] lg:gap-12">
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
                                className="animate-fade-in-up group inline-flex w-full items-center justify-center gap-3 border-2 border-black bg-white px-6 py-4 text-sm font-black uppercase tracking-widest text-black shadow-neo opacity-0 transition-all hover:-translate-y-0.5 hover:bg-[#fef08a] hover:shadow-neo-lg sm:w-auto"
                                style={{ animationDelay: '0.56s' }}
                            >
                                <Server size={18} strokeWidth={3} />
                                Self-host Rejourney
                            </Link>
                        </div>
                    </div>

                    <div className="relative hidden animate-fade-in-right opacity-0 lg:block" style={{ animationDelay: '0.2s' }}>
                        <div className="relative mx-auto h-[360px] max-w-sm border-2 border-black bg-white shadow-[14px_14px_0px_0px_rgba(0,0,0,1)]">
                            <div className="absolute left-7 top-7 h-24 w-24 rotate-[-8deg] border-2 border-black bg-[#5dadec] shadow-neo" />
                            <div className="absolute right-8 top-16 h-20 w-20 rotate-[7deg] border-2 border-black bg-[#fef08a] shadow-neo" />
                            <div className="absolute bottom-8 left-10 h-24 w-28 rotate-[4deg] border-2 border-black bg-[#f9a8d4] shadow-neo" />
                            <div className="absolute bottom-14 right-10 h-28 w-24 rotate-[-5deg] border-2 border-black bg-[#86efac] shadow-neo" />

                            <div className="absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                                <img
                                    src="/rejourneyIcon-removebg-preview.png"
                                    alt=""
                                    role="presentation"
                                    className="h-24 w-24 object-contain"
                                />
                            </div>
                            <span className="absolute right-5 top-5 border-2 border-black bg-white px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest shadow-neo-sm">
                                13.2 kB
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
