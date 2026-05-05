import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
    Bar,
    BarChart,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

const BUNDLEPHOBIA_REJOURNEY =
    'https://bundlephobia.com/package/@rejourneyco/react-native@1.0.17';
const BUNDLEPHOBIA_SENTRY =
    'https://bundlephobia.com/package/@sentry/react-native@8.7.0';

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

export const PerformanceMetrics: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const [isVisible, setIsVisible] = useState(false);

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

    return (
        <section ref={sectionRef} className="relative w-full overflow-hidden border-t-2 border-black bg-slate-50 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

            <div className="max-w-7xl mx-auto relative z-10">

                {/* Header Section */}
                <div className="mb-10 flex flex-col items-start justify-between gap-6 lg:mb-16 lg:flex-row lg:items-end lg:gap-8">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-4 h-4 text-[#5dadec]" />
                            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#5dadec]">Efficiency Audit</span>
                        </div>
                        <h2 className="mb-4 text-4xl font-black uppercase leading-[0.88] tracking-tight sm:text-7xl sm:tracking-tighter">
                            Tiny Footprint.<br />
                            <span className="text-gray-400">Extreme Impact.</span>
                        </h2>
                        <p className="max-w-xl break-words font-mono text-[11px] font-bold uppercase leading-relaxed tracking-wide text-gray-500 sm:text-sm sm:tracking-widest">
                            {rejourneyEfficiencyX}× smaller minified JS bundle vs {sentryRow.shortLabel}@{sentryRow.version} (BundlePhobia)
                        </p>
                    </div>

                    {/* Floating Badge */}
                    <div className="hidden lg:block bg-black text-white p-6 border-2 border-black shadow-[8px_8px_0px_0px_rgba(93,173,236,1)] rotate-2">
                        <p className="text-4xl font-black font-mono">{rejourneyEfficiencyX}X</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest mt-1">Smaller JS bundle</p>
                    </div>
                </div>

                {/* Main Content Box */}
                <div className="border-2 border-black bg-white p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] sm:p-10 sm:shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]">

                    {/* Top Row: SDK Size Comparison */}
                    <div className="mb-12 grid grid-cols-1 gap-10 border-b-2 border-black border-dashed pb-10 lg:mb-16 lg:grid-cols-[1.5fr_1fr] lg:gap-12 lg:pb-12">

                        {/* Chart Area */}
                        <div className="flex flex-col h-full">
                            <div className="mb-5 flex flex-col gap-3 border-b-2 border-black pb-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:pb-2">
                                <h3 className="text-base font-black uppercase tracking-tight sm:text-lg">Npm bundle size (BundlePhobia)</h3>
                                <div className="flex flex-wrap gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-[#1e3a5f] border-2 border-black" aria-hidden />
                                        <span className="text-[10px] font-bold uppercase">Gzip</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 bg-[#bfdbfe] border-2 border-black" aria-hidden />
                                        <span className="text-[10px] font-bold uppercase">Minified − gzip</span>
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
                                                    if (n === 'minifiedAboveGzipKb') return [`${v.toFixed(1)} kB`, 'Minified − gzip'];
                                                    if (n === 'gzipKb') return [`${v.toFixed(1)} kB`, 'Gzipped'];
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
                                Bar height = minified size; darker segment = gzipped transfer size (same layout as BundlePhobia).
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
                                        minified
                                    </span>
                                </div>
                                <p className="text-sm font-mono font-bold text-gray-700 mt-1">
                                    {rejourneyRow.gzipKb} kB gzipped
                                </p>
                                <a
                                    href={rejourneyRow.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold font-mono uppercase text-gray-500 underline decoration-2 underline-offset-2 hover:text-black"
                                >
                                    <ArrowDownRight className="w-3.5 h-3.5 text-[#008000]" aria-hidden />
                                    BundlePhobia @{rejourneyRow.version}
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
                                        minified
                                    </span>
                                </div>
                                <p className="text-sm font-mono font-bold text-gray-700 mt-1">
                                    {sentryRow.gzipKb} kB gzipped
                                </p>
                                <a
                                    href={sentryRow.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold font-mono uppercase text-gray-500 underline decoration-2 underline-offset-2 hover:text-black"
                                >
                                    <ArrowUpRight className="w-3.5 h-3.5 text-[#ef4444]" aria-hidden />
                                    BundlePhobia @{sentryRow.version}
                                </a>
                                <p className="text-[10px] font-mono text-gray-500 uppercase mt-3 max-w-[240px] leading-tight">
                                    Includes transitive npm dependencies in BundlePhobia&apos;s model.
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Performance Metrics Table */}
                    <div className="mt-10 sm:mt-12">
                        <div className="mb-5 border-b-2 border-black pb-3 sm:mb-6 sm:pb-2">
                            <h3 className="text-lg font-black uppercase tracking-tight">Performance Metrics</h3>
                            <p className="mt-1 text-[10px] font-mono uppercase leading-relaxed text-gray-500">iPhone 15 Pro; iOS 18; Expo SDK 54; React Native New Architecture. Running on <a href="https://merchcampus.com" target="_blank" rel="noopener noreferrer" className="underline">Merch App</a>. Production build.</p>
                        </div>

                        <div className="grid gap-3 md:hidden">
                            {performanceMetricRows.map((row) => (
                                <article key={row.metric} className="border-2 border-black bg-[#f8fafc] p-3 shadow-neo-sm">
                                    <div className="mb-3 flex items-start justify-between gap-3 border-b-2 border-black pb-2">
                                        <h4 className="text-xs font-black uppercase leading-tight">{row.metric}</h4>
                                        <span className={`shrink-0 text-[10px] font-black uppercase ${row.threadClassName}`}>
                                            {row.thread}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 font-mono text-[10px] font-black uppercase">
                                        <div className="border-2 border-black bg-white p-2">
                                            <p className="text-gray-500">Avg</p>
                                            <p className="mt-1 text-sm text-black">{row.average}</p>
                                        </div>
                                        <div className="border-2 border-black bg-white p-2">
                                            <p className="text-gray-500">Max</p>
                                            <p className="mt-1 text-sm text-black">{row.max}</p>
                                        </div>
                                        <div className="border-2 border-black bg-white p-2">
                                            <p className="text-gray-500">Min</p>
                                            <p className="mt-1 text-sm text-black">{row.min}</p>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>

                        <div className="hidden overflow-x-auto border-2 border-black bg-white md:block">
                            <table className="w-full min-w-[720px] border-collapse">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="text-left py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">Metric</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">Average (ms)</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">Max (ms)</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest border-r-2 border-white">Min (ms)</th>
                                        <th className="text-right py-3 px-4 text-[10px] font-black uppercase tracking-widest">Thread</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {performanceMetricRows.map((row, index) => (
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

                </div>
            </div>
        </section>
    );
};
