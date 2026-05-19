import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
    Bar,
    BarChart,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { MarketingHomeCopy } from '~/shared/lib/internationalMarketing';

const BUNDLEPHOBIA_REJOURNEY =
    'https://bundlephobia.com/package/@rejourneyco/react-native@1.0.17';
const BUNDLEPHOBIA_SENTRY =
    'https://bundlephobia.com/package/@sentry/react-native@8.7.0';
const BUNDLEPHOBIA_WEB_REJOURNEY =
    'https://bundlephobia.com/package/@rejourneyco/browser@0.1.0';
const BUNDLEPHOBIA_POSTHOG =
    'https://bundlephobia.com/package/posthog-js@1.374.2';
const GITHUB_REPO_URL = 'https://github.com/rejourneyco/rejourney';
const WEB_BENCHMARK_RESULT_PATH =
    'benchmarks/web-analytics/results/2026-05-19T03-47-21-774Z/benchmark-report.md';
const WEB_BENCHMARK_REPORT_URL = `${GITHUB_REPO_URL}/blob/main/${WEB_BENCHMARK_RESULT_PATH}`;
const POSTHOG_BRAND_ORANGE = '#f54e00';
const POSTHOG_BRAND_ORANGE_DARK = '#c23d00';
const POSTHOG_BRAND_ORANGE_LIGHT = '#f5e2b2';

/** BundlePhobia npm entry-point sizes (minified + gzipped), fixed versions. */
const bundleCompareRows = [
    {
        key: 'rejourney',
        label: 'Rejourney',
        shortLabel: '@rejourneyco/react-native',
        version: '1.0.17',
        minifiedKb: 39.7,
        gzipKb: 13.2,
        href: BUNDLEPHOBIA_REJOURNEY,
        gzipFill: '#3b82c4',
        minExtraFill: '#93c5fd',
    },
    {
        key: 'sentry',
        label: 'Sentry',
        shortLabel: '@sentry/react-native',
        version: '8.7.0',
        minifiedKb: 403,
        gzipKb: 135.3,
        href: BUNDLEPHOBIA_SENTRY,
        gzipFill: '#b91c1c',
        minExtraFill: '#f87171',
    },
] as const;

const bundleChartData = bundleCompareRows.map((row) => ({
    name: row.label,
    gzipKb: row.gzipKb,
    minifiedAboveGzipKb: Math.max(0, row.minifiedKb - row.gzipKb),
    minifiedKb: row.minifiedKb,
    href: row.href,
}));

const webBenchmarkRows = [
    {
        app: 'Next.js',
        rejourneyUploadKb: 21.29,
        posthogUploadKb: 45.35,
        rejourneyTaskMs: 417.96,
        posthogTaskMs: 449.91,
        rejourneyScriptMs: 160.46,
        posthogScriptMs: 185.06,
        rejourneyHeapMb: 15.81,
        posthogHeapMb: 16.19,
        uploadWin: '2.1x',
    },
    {
        app: 'SvelteKit',
        rejourneyUploadKb: 8.38,
        posthogUploadKb: 24.99,
        rejourneyTaskMs: 268.72,
        posthogTaskMs: 304.03,
        rejourneyScriptMs: 19.35,
        posthogScriptMs: 42.02,
        rejourneyHeapMb: 6.63,
        posthogHeapMb: 9.17,
        uploadWin: '3.0x',
    },
    {
        app: 'Nuxt',
        rejourneyUploadKb: 8.4,
        posthogUploadKb: 26.57,
        rejourneyTaskMs: 305.51,
        posthogTaskMs: 322.24,
        rejourneyScriptMs: 21.12,
        posthogScriptMs: 41.17,
        rejourneyHeapMb: 11.33,
        posthogHeapMb: 15.44,
        uploadWin: '3.2x',
    },
] as const;

const webPackageCompareRows = [
    {
        key: 'rejourney',
        name: 'Rejourney',
        label: '@rejourneyco/browser',
        version: '0.1.0',
        minifiedKb: 52.3,
        gzipKb: 15.9,
        minified: '52.3 kB',
        gzip: '15.9 kB',
        href: BUNDLEPHOBIA_WEB_REJOURNEY,
        colorClassName: 'text-[#5dadec]',
        gzipFill: '#3b82c4',
        distExtraFill: '#93c5fd',
        arrow: 'down',
    },
    {
        key: 'posthog',
        name: 'PostHog',
        label: 'posthog-js',
        version: '1.374.2',
        minifiedKb: 187.5,
        gzipKb: 61.5,
        minified: '187.5 kB',
        gzip: '61.5 kB',
        href: BUNDLEPHOBIA_POSTHOG,
        colorClassName: 'text-[#f54e00]',
        gzipFill: POSTHOG_BRAND_ORANGE_DARK,
        distExtraFill: POSTHOG_BRAND_ORANGE_LIGHT,
        arrow: 'up',
    },
] as const;

const webPackageChartData = webPackageCompareRows.map((row) => ({
    name: row.name,
    gzipKb: row.gzipKb,
    minifiedAboveGzipKb: Math.max(0, row.minifiedKb - row.gzipKb),
    minifiedKb: row.minifiedKb,
    minified: row.minified,
    gzip: row.gzip,
}));

const formatBundlephobiaSize = (kb: number) => `${kb.toFixed(kb >= 100 ? 0 : 1)} kB`;

const webComparisonCharts = [
    {
        key: 'upload',
        title: 'SDK upload body',
        detail: 'Payload sent during the measured live replay session.',
        rejourneyKey: 'rejourneyUploadKb',
        posthogKey: 'posthogUploadKb',
        unit: 'KiB',
        domain: [0, 55],
        winner: '3.0x median smaller live upload',
    },
    {
        key: 'task',
        title: 'Browser task time',
        detail: 'Total Chromium task duration, used as the CPU proxy.',
        rejourneyKey: 'rejourneyTaskMs',
        posthogKey: 'posthogTaskMs',
        unit: 'ms',
        domain: [0, 480],
        winner: '1.1x lower median task time',
    },
    {
        key: 'script',
        title: 'Script execution',
        detail: 'Main-thread JavaScript execution during the run.',
        rejourneyKey: 'rejourneyScriptMs',
        posthogKey: 'posthogScriptMs',
        unit: 'ms',
        domain: [0, 210],
        winner: '2.0x lower median script time',
    },
    {
        key: 'heap',
        title: 'Final JS heap',
        detail: 'JavaScript heap at the end of the benchmark run.',
        rejourneyKey: 'rejourneyHeapMb',
        posthogKey: 'posthogHeapMb',
        unit: 'MiB',
        domain: [0, 18],
        winner: '1.4x lower median heap',
    },
] as const;

const performanceMetricRows = [
    {
        metric: 'Main: UIKit + Metal Capture',
        average: '12.4',
        max: '28.2',
        min: '8.1',
        thread: 'Main',
        threadClassName: 'text-red-600',
    },
    {
        metric: 'BG: Async Image Processing',
        average: '42.5',
        max: '88.0',
        min: '32.4',
        thread: 'Background',
        threadClassName: 'text-green-600',
    },
    {
        metric: 'BG: Tar+Gzip Compression',
        average: '14.2',
        max: '32.5',
        min: '9.6',
        thread: 'Background',
        threadClassName: 'text-green-600',
    },
    {
        metric: 'BG: Upload Handshake',
        average: '0.8',
        max: '2.4',
        min: '0.3',
        thread: 'Background',
        threadClassName: 'text-green-600',
    },
    {
        metric: 'Total Main Thread Impact',
        average: '12.4',
        max: '28.2',
        min: '8.1',
        thread: 'Main',
        threadClassName: 'text-red-600',
    },
];

export const PerformanceMetrics: React.FC<{ copy: MarketingHomeCopy['performance']; dir?: 'ltr' | 'rtl' }> = ({ copy, dir = 'ltr' }) => {
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [activeGalleryPanel, setActiveGalleryPanel] = useState<'web' | 'mobile'>('web');

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        if (sectionRef.current) {
            observer.observe(sectionRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const rejourneyRow = bundleCompareRows[0];
    const sentryRow = bundleCompareRows[1];
    const rejourneyEfficiencyX = (sentryRow.minifiedKb / rejourneyRow.minifiedKb).toFixed(1);
    const webUploadEfficiencyX = '3.0';
    const webPackageEfficiencyX = '3.9';
    const activeSummary = activeGalleryPanel === 'web'
        ? `${webPackageEfficiencyX}X smaller gzipped Bundlephobia package size vs posthog-js. ${webUploadEfficiencyX}X smaller median live web SDK upload across Next.js, SvelteKit, and Nuxt.`
        : copy.bundleSummary(rejourneyEfficiencyX, sentryRow.shortLabel, sentryRow.version);
    const activeBadgeValue = activeGalleryPanel === 'web' ? `${webPackageEfficiencyX}X` : `${rejourneyEfficiencyX}X`;
    const activeBadgeLabel = activeGalleryPanel === 'web' ? 'smaller Bundlephobia gzip' : copy.smallerBundle;
    const renderedMetricRows = performanceMetricRows.map((row, index) => ({
        ...row,
        ...(copy.metricRows[index] ?? {}),
    }));

    return (
        <section ref={sectionRef} dir={dir} className="relative w-full overflow-hidden border-t-2 border-black bg-slate-50 px-4 py-14 sm:px-6 sm:py-24 lg:px-8">
<div className="max-w-7xl mx-auto relative z-10">

                {/* Header Section */}
                <div className="mb-10 flex flex-col items-start justify-between gap-6 lg:mb-16 lg:flex-row lg:items-end lg:gap-8">
                    <div className="min-w-0">
                        <h2 className="mb-4 break-words text-3xl font-black uppercase leading-tight tracking-tight sm:text-7xl sm:tracking-tighter">
                            {copy.headingPrimary}<br />
                            <span className="text-gray-400">{copy.headingSecondary}</span>
                        </h2>
                        <p className="max-w-xl break-words font-mono text-[11px] font-bold uppercase leading-relaxed tracking-wide text-gray-500 sm:text-sm sm:tracking-widest">
                            {activeSummary}
                        </p>
                    </div>

                    {/* Floating Badge */}
                    <div className="hidden lg:block bg-black text-white p-6 border-2 border-black shadow-[8px_8px_0px_0px_rgba(93,173,236,1)] rotate-2">
                        <p className="text-4xl font-black font-mono">{activeBadgeValue}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest mt-1">{activeBadgeLabel}</p>
                    </div>
                </div>

                {/* Main Content Box */}
                <div id="benchmark-gallery" className="max-w-full scroll-mt-24 border-2 border-black bg-white p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] sm:scroll-mt-32 sm:p-10 sm:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">
                    <div className="mb-8 flex flex-col gap-3 border-b-2 border-black pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-mono text-[10px] font-black uppercase tracking-widest text-gray-500">
                                Benchmark gallery
                                <a
                                    href="#benchmark-gallery"
                                    aria-label="Link to benchmark gallery"
                                    className="ml-2 text-gray-400 underline decoration-2 underline-offset-2 hover:text-black"
                                >
                                    #
                                </a>
                            </p>
                            <h3 className="mt-1 text-xl font-black uppercase leading-tight">Last But Not Least</h3>
                        </div>
                        <div className="grid w-full grid-cols-1 border-2 border-black bg-slate-100 text-[10px] font-black uppercase tracking-widest min-[420px]:grid-cols-2 sm:w-auto">
                            <button
                                type="button"
                                aria-pressed={activeGalleryPanel === 'web'}
                                onClick={() => setActiveGalleryPanel('web')}
                                className={`px-4 py-3 text-left transition-colors min-[420px]:text-center sm:text-left ${activeGalleryPanel === 'web' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-slate-50'}`}
                            >
                                Web vs PostHog
                            </button>
                            <button
                                type="button"
                                aria-pressed={activeGalleryPanel === 'mobile'}
                                onClick={() => setActiveGalleryPanel('mobile')}
                                className={`border-t-2 border-black px-4 py-3 text-left transition-colors min-[420px]:border-l-2 min-[420px]:border-t-0 min-[420px]:text-center sm:text-left ${activeGalleryPanel === 'mobile' ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-slate-50'}`}
                            >
                                Mobile vs Sentry
                            </button>
                        </div>
                    </div>

                    {activeGalleryPanel === 'web' ? (
                        <>
                            <div className="mb-10 grid grid-cols-1 gap-8 border-b-2 border-black border-dashed pb-8 lg:mb-16 lg:grid-cols-[1.45fr_1fr] lg:gap-12 lg:pb-12">
                                <div className="flex min-w-0 flex-col">
                                    <div className="mb-5 flex flex-col gap-3 border-b-2 border-black pb-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:pb-2">
                                        <h3 className="text-base font-black uppercase tracking-tight sm:text-lg">Bundlephobia package size</h3>
                                        <div className="flex flex-wrap gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 border-2 border-black bg-[#1e3a5f]" aria-hidden />
                                                <span className="text-[10px] font-bold uppercase">Gzip</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="h-3 w-3 border-2 border-black bg-[#bfdbfe]" aria-hidden />
                                                <span className="text-[10px] font-bold uppercase">Minified - gzip</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative h-[260px] border-2 border-black bg-slate-50 p-2 sm:h-[300px] sm:p-4 lg:h-[330px]">
                                        {isVisible && (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={webPackageChartData}
                                                    margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                                                    barCategoryGap="28%"
                                                >
                                                    <XAxis
                                                        dataKey="name"
                                                        axisLine={{ stroke: '#000' }}
                                                        tickLine={{ stroke: '#000' }}
                                                        tick={{ fill: '#000', fontSize: 11, fontFamily: 'monospace', fontWeight: 800 }}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={{ stroke: '#000' }}
                                                        tick={{ fill: '#000', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}
                                                        tickFormatter={(v) => formatBundlephobiaSize(Number(v))}
                                                        domain={[0, Math.ceil(webPackageCompareRows[1].minifiedKb * 1.08)]}
                                                        width={58}
                                                    />
                                                    <Tooltip
                                                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                                        contentStyle={{
                                                            backgroundColor: '#000',
                                                            border: 'none',
                                                            color: '#fff',
                                                            fontSize: '12px',
                                                            fontFamily: 'monospace',
                                                            textTransform: 'uppercase',
                                                        }}
                                                        itemStyle={{ color: '#fff' }}
                                                        formatter={(value: number | undefined, name: string | undefined) => {
                                                            const v = value ?? 0;
                                                            const label = name === 'minifiedAboveGzipKb' ? 'Minified minus gzip' : 'Gzip';
                                                            return [formatBundlephobiaSize(v), label];
                                                        }}
                                                        labelFormatter={(_, payload) => {
                                                            const p = payload?.[0]?.payload as { minified?: string; gzip?: string } | undefined;
                                                            return p ? `Minified: ${p.minified} / gzip: ${p.gzip}` : '';
                                                        }}
                                                    />
                                                    <Bar dataKey="gzipKb" stackId="bp-web" radius={[0, 0, 0, 0]} isAnimationActive={false}>
                                                        {webPackageCompareRows.map((row) => (
                                                            <Cell key={`wg-${row.key}`} fill={row.gzipFill} />
                                                        ))}
                                                    </Bar>
                                                    <Bar dataKey="minifiedAboveGzipKb" stackId="bp-web" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                                                        {webPackageCompareRows.map((row) => (
                                                            <Cell key={`wd-${row.key}`} fill={row.distExtraFill} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        )}
                                    </div>

                                    <p className="mt-4 font-mono text-[10px] font-bold uppercase leading-relaxed text-gray-500">
                                        Bundlephobia fixed-version package size. Darker segment is minified + gzipped; full bar is minified.
                                    </p>
                                </div>

                                <div className="flex flex-col justify-center space-y-8 lg:border-l-2 lg:border-dashed lg:border-black lg:pl-12">
                                    {webPackageCompareRows.map((row) => (
                                        <div key={row.key}>
                                            <p className={`mb-2 font-mono text-[10px] font-black uppercase tracking-widest ${row.colorClassName}`}>
                                                {row.label}
                                            </p>
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                <span className={`font-mono text-5xl font-black tracking-tighter sm:text-6xl ${row.key === 'rejourney' ? 'text-[#5dadec]' : ''}`}>
                                                    {row.minifiedKb}
                                                </span>
                                                <span className={`text-xl font-bold uppercase ${row.key === 'rejourney' ? 'text-[#5dadec]' : ''}`}>kB</span>
                                                <span className="font-mono text-[10px] font-bold uppercase text-gray-500">
                                                    {copy.minified}
                                                </span>
                                            </div>
                                            <p className="mt-1 font-mono text-sm font-bold text-gray-700">
                                                {row.gzipKb} {copy.gzipped}
                                            </p>
                                            <a
                                                href={row.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase text-gray-500 underline decoration-2 underline-offset-2 hover:text-black"
                                            >
                                                {row.arrow === 'down' ? (
                                                    <ArrowDownRight className="h-3.5 w-3.5 text-[#008000]" aria-hidden />
                                                ) : (
                                                    <ArrowUpRight className="h-3.5 w-3.5 text-[#f54e00]" aria-hidden />
                                                )}
                                                {copy.bundlePhobiaVersion(row.version)}
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="mb-6 border-b-2 border-black pb-3">
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                        <div>
                                            <h3 className="text-lg font-black uppercase tracking-tight">Web benchmark graphs</h3>
                                            <p className="mt-1 font-mono text-[10px] uppercase leading-relaxed text-gray-500">
                                                Next.js, SvelteKit, and Nuxt examples from 18 live Chromium runs. Lower bars win.
                                            </p>
                                        </div>
                                        <a
                                            href={WEB_BENCHMARK_REPORT_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-mono text-[10px] font-black uppercase text-gray-500 underline decoration-2 underline-offset-2 hover:text-black"
                                        >
                                            Open evidence report
                                        </a>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                    {webComparisonCharts.map((chart) => (
                                        <div key={chart.key} className="border-2 border-black bg-white p-4">
                                            <div className="mb-4 flex flex-col gap-3 border-b-2 border-black pb-3 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                                                <div>
                                                    <h4 className="text-sm font-black uppercase tracking-tight">{chart.title}</h4>
                                                    <p className="mt-1 font-mono text-[10px] font-bold uppercase leading-relaxed text-gray-500">{chart.detail}</p>
                                                </div>
                                                <div className="shrink-0 bg-black px-3 py-2 font-mono text-[10px] font-black uppercase text-white">
                                                    {chart.winner}
                                                </div>
                                            </div>

                                            <div className="h-[220px] border-2 border-black bg-slate-50 p-2 sm:h-[240px]">
                                                {isVisible && (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={webBenchmarkRows}
                                                            margin={{ top: 8, right: 10, left: 0, bottom: 8 }}
                                                            barCategoryGap="20%"
                                                        >
                                                            <XAxis
                                                                dataKey="app"
                                                                axisLine={{ stroke: '#000' }}
                                                                tickLine={{ stroke: '#000' }}
                                                                tick={{ fill: '#000', fontSize: 10, fontFamily: 'monospace', fontWeight: 800 }}
                                                            />
                                                            <YAxis
                                                                axisLine={false}
                                                                tickLine={{ stroke: '#000' }}
                                                                tick={{ fill: '#000', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}
                                                                tickFormatter={(v) => `${v} ${chart.unit}`}
                                                                domain={[chart.domain[0], chart.domain[1]]}
                                                                width={44}
                                                            />
                                                            <Tooltip
                                                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                                                contentStyle={{
                                                                    backgroundColor: '#000',
                                                                    border: 'none',
                                                                    color: '#fff',
                                                                    fontSize: '12px',
                                                                    fontFamily: 'monospace',
                                                                    textTransform: 'uppercase',
                                                                }}
                                                                itemStyle={{ color: '#fff' }}
                                                                formatter={(value: number | undefined, name: string | undefined) => {
                                                                    const v = value ?? 0;
                                                                    const decimals = chart.unit === 'KiB' || chart.unit === 'MiB' ? 2 : 1;
                                                                    const label = name === chart.posthogKey ? 'PostHog' : 'Rejourney';
                                                                    return [`${v.toFixed(decimals)} ${chart.unit}`, label];
                                                                }}
                                                            />
                                                            <Bar dataKey={chart.rejourneyKey} fill="#5dadec" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                                            <Bar dataKey={chart.posthogKey} fill={POSTHOG_BRAND_ORANGE} radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                )}
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-4 font-mono text-[10px] font-black uppercase text-gray-600">
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="h-3 w-3 border-2 border-black bg-[#5dadec]" aria-hidden />
                                                    Rejourney
                                                </span>
                                                <span className="inline-flex items-center gap-2">
                                                    <span className="h-3 w-3 border-2 border-black bg-[#f54e00]" aria-hidden />
                                                    PostHog
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>

                    {/* Top Row: SDK Size Comparison */}
                    <div className="mb-12 grid grid-cols-1 gap-10 border-b-2 border-black border-dashed pb-10 lg:mb-16 lg:grid-cols-[1.5fr_1fr] lg:gap-12 lg:pb-12">

                        {/* Chart Area */}
                        <div className="flex flex-col h-full">
                            <div className="mb-5 flex flex-col gap-3 border-b-2 border-black pb-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:pb-2">
                                <h3 className="text-base font-black uppercase tracking-tight sm:text-lg">{copy.chartTitle}</h3>
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-[#1e3a5f] border-2 border-black" aria-hidden />
                                        <span className="text-[10px] font-bold uppercase">{copy.gzip}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-[#bfdbfe] border-2 border-black" aria-hidden />
                                        <span className="text-[10px] font-bold uppercase">{copy.minifiedMinusGzip}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="relative min-h-[240px] flex-grow border-2 border-black bg-slate-50 p-2 sm:min-h-[280px] sm:p-4">
                                {isVisible && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={bundleChartData}
                                            margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                                            barCategoryGap="28%"
                                        >
                                            <XAxis
                                                dataKey="name"
                                                axisLine={{ stroke: '#000' }}
                                                tickLine={{ stroke: '#000' }}
                                                tick={{ fill: '#000', fontSize: 11, fontFamily: 'monospace', fontWeight: 800 }}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={{ stroke: '#000' }}
                                                tick={{ fill: '#000', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}
                                                tickFormatter={(v) => `${v} kB`}
                                                domain={[0, Math.ceil(sentryRow.minifiedKb * 1.08)]}
                                                width={44}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                                                contentStyle={{
                                                    backgroundColor: '#000',
                                                    border: 'none',
                                                    color: '#fff',
                                                    fontSize: '12px',
                                                    fontFamily: 'monospace',
                                                    textTransform: 'uppercase',
                                                }}
                                                itemStyle={{ color: '#fff' }}
                                                formatter={(value: number | undefined, name: string | undefined) => {
                                                    const v = value ?? 0;
                                                    const n = name ?? '';
                                                    if (n === 'minifiedAboveGzipKb') return [`${v.toFixed(1)} kB`, copy.minifiedMinusGzip];
                                                    if (n === 'gzipKb') return [`${v.toFixed(1)} kB`, copy.gzip];
                                                    return [`${v} kB`, n];
                                                }}
                                                labelFormatter={(_, payload) => {
                                                    const p = payload?.[0]?.payload as { minifiedKb?: number; href?: string } | undefined;
                                                    const total = p?.minifiedKb;
                                                    return total != null ? `Total minified: ${total} kB` : '';
                                                }}
                                            />
                                            <Bar dataKey="gzipKb" stackId="bp" radius={[0, 0, 0, 0]} isAnimationActive={false}>
                                                {bundleCompareRows.map((row) => (
                                                    <Cell key={`g-${row.key}`} fill={row.gzipFill} />
                                                ))}
                                            </Bar>
                                            <Bar dataKey="minifiedAboveGzipKb" stackId="bp" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                                                {bundleCompareRows.map((row) => (
                                                    <Cell key={`m-${row.key}`} fill={row.minExtraFill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                            <ul className="mt-4 flex flex-col gap-2 font-mono text-[10px] font-bold uppercase text-gray-600">
                                {bundleCompareRows.map((row) => (
                                    <li key={row.key}>
                                        <a
                                            href={row.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline decoration-2 underline-offset-2 hover:text-black"
                                        >
                                            {row.shortLabel}@{row.version} — BundlePhobia
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-2 text-[10px] font-mono text-gray-500 uppercase leading-relaxed">
                                {copy.chartNote}
                            </p>
                        </div>

                        {/* Comparative Stats (Side Panel) — Rejourney first (smaller), Sentry second */}
                        <div className="flex flex-col justify-center space-y-8 lg:border-l-2 lg:border-dashed lg:border-black lg:pl-12">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#5dadec] mb-2">
                                    {rejourneyRow.shortLabel}
                                </p>
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="text-5xl sm:text-6xl font-black font-mono tracking-tighter text-[#5dadec]">
                                        {rejourneyRow.minifiedKb}
                                    </span>
                                    <span className="text-xl font-bold uppercase text-[#5dadec]">kB</span>
                                    <span className="text-[10px] font-bold font-mono uppercase text-gray-500">
                                        {copy.minified}
                                    </span>
                                </div>
                                <p className="text-sm font-mono font-bold text-gray-700 mt-1">
                                    {rejourneyRow.gzipKb} {copy.gzipped}
                                </p>
                                <a
                                    href={rejourneyRow.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold font-mono uppercase text-gray-500 underline decoration-2 underline-offset-2 hover:text-black"
                                >
                                    <ArrowDownRight className="w-3.5 h-3.5 text-[#008000]" aria-hidden />
                                    {copy.bundlePhobiaVersion(rejourneyRow.version)}
                                </a>
                            </div>

                            <div className="w-full h-px bg-black border-t border-dashed"></div>

                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-[#ef4444] mb-2">
                                    {sentryRow.shortLabel}
                                </p>
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                    <span className="text-5xl sm:text-6xl font-black font-mono tracking-tighter">
                                        {sentryRow.minifiedKb}
                                    </span>
                                    <span className="text-xl font-bold uppercase">kB</span>
                                    <span className="text-[10px] font-bold font-mono uppercase text-gray-500">
                                        {copy.minified}
                                    </span>
                                </div>
                                <p className="text-sm font-mono font-bold text-gray-700 mt-1">
                                    {sentryRow.gzipKb} {copy.gzipped}
                                </p>
                                <a
                                    href={sentryRow.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold font-mono uppercase text-gray-500 underline decoration-2 underline-offset-2 hover:text-black"
                                >
                                    <ArrowUpRight className="w-3.5 h-3.5 text-[#ef4444]" aria-hidden />
                                    {copy.bundlePhobiaVersion(sentryRow.version)}
                                </a>
                                <p className="text-[10px] font-mono text-gray-500 uppercase mt-3 max-w-[240px] leading-tight">
                                    {copy.transitiveNote}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Performance Metrics Table */}
                    <div className="mt-10 sm:mt-12">
                        <div className="mb-5 border-b-2 border-black pb-3 sm:mb-6 sm:pb-2">
                            <h3 className="text-lg font-black uppercase tracking-tight">{copy.metricsTitle}</h3>
                            <p className="mt-1 text-[10px] font-mono uppercase leading-relaxed text-gray-500">{copy.metricsNotePrefix} <a href="https://merchcampus.com" target="_blank" rel="noopener noreferrer" className="underline">{copy.metricsNoteApp}</a>. {copy.metricsNoteSuffix}</p>
                        </div>

                        <div className="md:hidden border-2 border-black overflow-hidden">
                            {renderedMetricRows.map((row, index) => (
                                <div
                                    key={row.metric}
                                    className={`flex items-center justify-between gap-3 px-3 py-3 ${index < renderedMetricRows.length - 1 ? 'border-b-2 border-black' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-black uppercase leading-tight truncate">{row.metric}</p>
                                        <span className={`text-[9px] font-black uppercase ${row.threadClassName}`}>{row.thread}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0 font-mono text-[10px] font-bold uppercase">
                                        <div className="flex flex-col items-center border-l-2 border-black pl-3 pr-3">
                                            <span className="text-gray-400">{copy.tableAvgShort}</span>
                                            <span className="text-sm font-black text-black">{row.average}</span>
                                        </div>
                                        <div className="flex flex-col items-center border-l-2 border-black pl-3 pr-3">
                                            <span className="text-gray-400">{copy.tableMaxShort}</span>
                                            <span className="text-sm font-black text-black">{row.max}</span>
                                        </div>
                                        <div className="flex flex-col items-center border-l-2 border-black pl-3">
                                            <span className="text-gray-400">{copy.tableMinShort}</span>
                                            <span className="text-sm font-black text-black">{row.min}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto border-2 border-black bg-white md:block">
                            <table className="w-full min-w-[720px] border-collapse">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">{copy.tableMetric}</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">{copy.tableAverage}</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">{copy.tableMax}</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">{copy.tableMin}</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest">{copy.tableThread}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {renderedMetricRows.map((row, index) => (
                                        <tr key={row.metric} className={`${index < performanceMetricRows.length - 1 ? 'border-b-2 border-black' : ''} transition-colors hover:bg-slate-50`}>
                                            <td className="border-r-2 border-black px-4 py-3 text-xs font-black uppercase">{row.metric}</td>
                                            <td className="border-r-2 border-black px-4 py-3 text-right font-mono text-xs font-bold">{row.average}</td>
                                            <td className="border-r-2 border-black px-4 py-3 text-right font-mono text-xs font-bold">{row.max}</td>
                                            <td className="border-r-2 border-black px-4 py-3 text-right font-mono text-xs font-bold">{row.min}</td>
                                            <td className={`px-4 py-3 text-center text-xs font-bold ${row.threadClassName}`}>{row.thread}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                        </>
                    )}

                </div>
            </div>
        </section>
    );
};
