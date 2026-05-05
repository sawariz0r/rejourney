import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { MarkExpo, MarkReactNative, MarkSwift } from './PlatformMarks';

export const TrustBanners: React.FC = () => {
    return (
        <section
            aria-label="Trust and supported platforms"
            className="relative w-full overflow-hidden border-b-2 border-black bg-[#5dadec] px-4 py-5 text-black sm:px-6 lg:px-8"
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#000_1.5px,transparent_1.5px)] [background-size:18px_18px]"
                aria-hidden
            />
            <div className="relative mx-auto grid max-w-7xl grid-cols-2 gap-2 min-[440px]:grid-cols-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                <span className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-2 border-black bg-white px-2 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-3 sm:tracking-widest">
                    <img src="/Flag_of_Germany.svg" alt="" role="presentation" className="h-6 w-6 border border-black object-cover" />
                    Germany
                </span>
                <span className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-2 border-black bg-[#86efac] px-2 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-3 sm:tracking-widest">
                    <ShieldCheck size={16} strokeWidth={3} />
                    GDPR
                </span>
                <span className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-2 border-black bg-white px-2 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-3 sm:tracking-widest">
                    <img src="/rejourneyIcon-removebg-preview.png" alt="" role="presentation" className="h-6 w-6 object-contain" />
                    13.2 kB
                </span>
                <span className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-2 border-black bg-white px-2 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-3 sm:tracking-widest">
                    <MarkExpo className="h-5 w-5" />
                    Expo
                </span>
                <span className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-2 border-black bg-white px-2 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-3 sm:tracking-widest">
                    <MarkReactNative className="h-5 w-5 text-[#2563eb]" />
                    <span className="truncate">React Native</span>
                </span>
                <span className="inline-flex h-11 min-w-0 items-center justify-center gap-2 border-2 border-black bg-white px-2 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-3 sm:tracking-widest">
                    <MarkSwift className="h-5 w-5 text-[#f97316]" />
                    Swift
                </span>
            </div>
        </section>
    );
};
