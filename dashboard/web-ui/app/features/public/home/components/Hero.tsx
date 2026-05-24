import React from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { MarketingHomeCopy, MarketingLocale } from '~/shared/lib/internationalMarketing';

const LIVE_DEMO_PATH = '/demo/general';

const RetroHeroBlocks: React.FC = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-16 top-16 hidden h-32 w-72 -rotate-6 border-2 border-black bg-[#fff08a] shadow-[8px_8px_0_0_rgba(0,0,0,1)] md:block" />
        <div className="absolute -right-20 top-14 hidden h-28 w-72 rotate-12 border-2 border-black bg-[#f9a8d4] shadow-[8px_8px_0_0_rgba(0,0,0,1)] md:block" />
        <div className="absolute -left-28 bottom-[18rem] h-24 w-60 rotate-6 border-2 border-black bg-[#bbf7d0] shadow-[8px_8px_0_0_rgba(0,0,0,1)] sm:-left-12 sm:bottom-[20rem] sm:h-28 sm:w-72" />
        <div className="absolute -right-32 bottom-[14rem] h-20 w-56 -rotate-8 border-2 border-black bg-[#c4b5fd] shadow-[7px_7px_0_0_rgba(0,0,0,1)] sm:-right-16 sm:bottom-[18rem] sm:h-24 sm:w-68" />
    </div>
);

const ProductDemoPreview: React.FC = () => (
    <div className="relative mx-auto mt-9 w-full overflow-hidden border-2 border-black bg-white shadow-[10px_10px_0_0_rgba(0,0,0,1)] sm:mt-10" dir="ltr">
        <div className="flex min-h-12 items-center gap-3 border-b-2 border-black bg-[#c4b5fd] px-3 py-2 sm:px-4">
            <div className="flex shrink-0 items-center gap-1.5" aria-hidden>
                <span className="h-3 w-3 rounded-full border border-black bg-[#fb7185]" />
                <span className="h-3 w-3 rounded-full border border-black bg-[#facc15]" />
                <span className="h-3 w-3 rounded-full border border-black bg-[#22c55e]" />
            </div>
            <div className="min-w-0 flex-1 border-2 border-black bg-[#fefce8] px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-slate-700 sm:text-xs">
                Live Rejourney demo
            </div>
        </div>
        <div className="h-[520px] bg-slate-950 sm:h-[620px] lg:h-[760px]">
            <iframe
                src={LIVE_DEMO_PATH}
                title="Rejourney live demo"
                className="h-full w-full border-0 bg-white"
                loading="lazy"
            />
        </div>
    </div>
);

type HeroCopy = MarketingLocale['hero'];

const renderHeadlineWithProtectedPunctuation = (text: string) => {
    const match = text.match(/^([\s\S]*?)(\S+)([.!?])$/);

    if (!match) {
        return text;
    }

    const [, prefix, finalWord, punctuation] = match;

    return (
        <>
            {prefix}
            <span className="whitespace-nowrap">
                {finalWord}
                <span className="inline-block w-0">{punctuation}</span>
            </span>
        </>
    );
};

const renderHeroHeadline = (copy: HeroCopy, isRtl: boolean) => {
    const headlinePrimaryClass = isRtl
        ? 'block max-w-full break-words font-display text-[2.15rem] font-extrabold leading-[1.14] tracking-normal text-black min-[380px]:text-[2.55rem] sm:text-[3.2rem] md:text-[3.95rem] lg:text-[4.3rem] xl:text-[4.8rem]'
        : 'block max-w-full break-words text-balance font-display text-[2.35rem] font-extrabold leading-[1] tracking-normal text-black min-[380px]:text-[2.75rem] sm:text-[4rem] md:text-[4.75rem] lg:whitespace-nowrap lg:text-[5.1rem] xl:text-[5.5rem]';
    const headlineSecondaryClass = isRtl
        ? 'mt-3 block max-w-full break-words font-display text-[1.95rem] font-extrabold leading-[1.16] tracking-normal text-[#5dadec] min-[380px]:text-[2.25rem] sm:mt-4 sm:text-[2.95rem] md:text-[3.55rem] lg:mt-5 lg:text-[3.95rem] xl:text-[4.45rem]'
        : 'mt-4 block max-w-full break-words text-balance font-display text-[2.05rem] font-extrabold leading-[1.02] tracking-normal text-[#5dadec] min-[380px]:text-[2.25rem] sm:mt-4 sm:text-[3.85rem] md:text-[4.55rem] lg:mt-5 lg:whitespace-nowrap lg:text-[5rem] xl:text-[5.4rem]';

    return (
        <>
            <span className={headlinePrimaryClass}>
                {renderHeadlineWithProtectedPunctuation(copy.headlinePrimary)}
            </span>
            <span className={headlineSecondaryClass}>
                {renderHeadlineWithProtectedPunctuation(copy.headlineSecondary)}
            </span>
        </>
    );
};

export const Hero: React.FC<{ copy: HeroCopy; homeCopy: MarketingHomeCopy['hero']; dir?: 'ltr' | 'rtl' }> = ({ copy, homeCopy, dir = 'ltr' }) => {
    const isRtl = dir === 'rtl';

    return (
        <section
            aria-label={homeCopy.ariaLabel}
            className={`relative w-full overflow-hidden border-b-2 border-black bg-white px-4 pb-16 text-black sm:px-6 sm:pb-20 lg:px-8 lg:pb-28 ${isRtl ? 'pt-20 sm:pt-28 lg:pt-32' : 'pt-16 sm:pt-24 lg:pt-28'}`}
        >
            <RetroHeroBlocks />
            <div className="relative z-10 mx-auto max-w-7xl">
                <div className="mx-auto max-w-6xl space-y-8 text-center sm:space-y-9" dir={dir}>
                    <h1 className="mx-auto max-w-6xl text-black">
                        {renderHeroHeadline(copy, isRtl)}
                    </h1>

                    <p className="mx-auto max-w-4xl text-balance text-base font-bold leading-relaxed text-slate-700 sm:text-xl md:text-2xl">
                        {homeCopy.description}
                    </p>

                    <div className="flex flex-col justify-center gap-4 sm:flex-row sm:items-center">
                        <Link
                            to="/login"
                            className="inline-flex w-full items-center justify-center gap-3 border-2 border-black bg-[#16a34a] px-7 py-4 text-center text-base font-black text-white shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-y-0.5 hover:bg-[#15803d] hover:shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] sm:w-auto sm:px-10"
                        >
                            Get started $0
                            <ArrowRight size={19} strokeWidth={3} />
                        </Link>
                        <Link
                            to={LIVE_DEMO_PATH}
                            className="inline-flex w-full items-center justify-center gap-3 border-2 border-black bg-slate-950 px-7 py-4 text-center text-base font-black text-white shadow-[5px_5px_0px_0px_rgba(93,173,236,1)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-[7px_7px_0px_0px_rgba(93,173,236,1)] sm:w-auto sm:px-10"
                        >
                            Live demo
                            <ArrowRight size={19} strokeWidth={3} />
                        </Link>
                    </div>
                </div>
            </div>

            <ProductDemoPreview />
        </section>
    );
};
