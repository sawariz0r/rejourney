import React from 'react';
import { Droplet, ShieldCheck } from 'lucide-react';
import { MarkExpo, MarkReactNative, MarkSwift } from './PlatformMarks';

const badgeClass =
    'inline-flex h-11 shrink-0 items-center justify-center gap-2 border-2 border-black bg-white px-4 font-mono text-[10px] font-black uppercase tracking-wider shadow-neo-sm sm:h-12 sm:px-5 sm:tracking-widest';

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
            <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-2 sm:gap-3">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    <span className={`${badgeClass} bg-[#86efac]`}>
                        <ShieldCheck size={16} strokeWidth={3} />
                        GDPR
                    </span>
                    <span className={badgeClass}>
                        <MarkExpo className="h-5 w-5" />
                        Expo
                    </span>
                    <span className={badgeClass}>
                        <MarkReactNative className="h-5 w-5 text-[#2563eb]" />
                        <span className="truncate">React Native</span>
                    </span>
                    <span className={badgeClass}>
                        <MarkSwift className="h-5 w-5 text-[#f97316]" />
                        Swift
                    </span>
                    <span className={badgeClass}>
                        <Droplet className="h-5 w-5 fill-[#5dadec] text-[#5dadec]" strokeWidth={0} />
                        13.2 kB
                    </span>
                </div>
            </div>
        </section>
    );
};
