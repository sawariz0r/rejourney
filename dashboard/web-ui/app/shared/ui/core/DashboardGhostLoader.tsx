import React from 'react';
import { cn } from '~/shared/lib/cn';

export type DashboardGhostLoaderVariant =
  | 'general'
  | 'analytics'
  | 'list'
  | 'map'
  | 'settings'
  | 'alerts';

interface DashboardGhostLoaderProps {
  variant?: DashboardGhostLoaderVariant;
}

const GhostBlock: React.FC<{ className?: string }> = ({ className }) => (
  <div
    aria-hidden="true"
    className={cn(
      'dashboard-ghost-block rounded-none border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]',
      className,
    )}
  />
);

const GhostSurface: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <div
    className={cn(
      'dashboard-card-surface bg-white/90 p-5',
      className,
    )}
  >
    {children}
  </div>
);

const DashboardHeaderGhost: React.FC<{ actionCount?: number }> = ({ actionCount = 2 }) => (
  <div className="sticky top-0 z-30 border-b-2 border-black bg-[#f8fafc]">
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <GhostBlock className="h-12 w-12 rounded-none" />
        <div className="min-w-0 flex-1 space-y-2" style={{ minWidth: 'min(100%, 13rem)' }}>
          <GhostBlock className="h-6 w-40 max-w-[60vw]" />
          <GhostBlock className="h-3 w-64 max-w-[70vw]" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: actionCount }).map((_, index) => (
          <GhostBlock key={index} className="h-10 w-24 rounded-none" />
        ))}
      </div>
    </div>
  </div>
);

const SettingsHeaderGhost: React.FC = () => (
  <div className="sticky top-0 z-50 border-b-2 border-black bg-[#f8fafc]">
    <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-1 items-center gap-6">
        <GhostBlock className="h-8 w-40 rounded-none" />
        <div className="hidden h-8 w-0.5 bg-black md:block" />
        <GhostBlock className="hidden h-3 w-52 rounded-none md:block" />
      </div>
      <GhostBlock className="h-9 w-28 rounded-none" />
    </div>
  </div>
);

const GeneralPageHeaderGhost: React.FC = () => (
  <div className="w-full border-b-2 border-black bg-[#f8fafc]">
    <div className="mx-auto grid w-full max-w-[1800px] gap-x-4 gap-y-3 px-4 py-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
      <div className="flex min-w-0 flex-wrap items-start gap-3 sm:gap-4">
        <GhostBlock className="mt-0.5 h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2" style={{ minWidth: 'min(100%, 13rem)' }}>
          <GhostBlock className="h-7 w-44 max-w-[65vw] rounded-none" />
        </div>
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:gap-3 xl:justify-end">
        <GhostBlock className="h-10 w-full max-w-[min(100%,20rem)] rounded-none sm:w-56" />
      </div>
    </div>
  </div>
);

const GeneralGhostBody: React.FC = () => (
  <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 sm:px-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <GhostSurface key={`momentum-${index}`} className="px-4 py-3">
          <GhostBlock className="h-3 w-28 rounded-none" />
          <GhostBlock className="mt-3 h-8 w-20 rounded-none" />
          <GhostBlock className="mt-2 h-3 w-32 rounded-none" />
        </GhostSurface>
      ))}
    </div>

    {Array.from({ length: 2 }).map((_, rowIndex) => (
      <div key={`ga4-row-${rowIndex}`} className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((__, cardIndex) => (
          <GhostSurface key={`ga4-${rowIndex}-${cardIndex}`} className="min-h-[280px]">
            <GhostBlock className="h-5 w-48 max-w-[85%] rounded-none" />
            <GhostBlock className="mt-4 h-36 w-full rounded-none" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <GhostBlock className="h-14 rounded-none" />
              <GhostBlock className="h-14 rounded-none" />
            </div>
          </GhostSurface>
        ))}
      </div>
    ))}

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <GhostSurface key={`ga4-wide-${index}`} className="min-h-[260px]">
          <GhostBlock className="h-5 w-40 max-w-[80%] rounded-none" />
          <GhostBlock className="mt-4 h-44 w-full rounded-none" />
          <div className="mt-4 flex flex-wrap gap-3">
            <GhostBlock className="h-3 w-16 rounded-none" />
            <GhostBlock className="h-3 w-20 rounded-none" />
            <GhostBlock className="h-3 w-14 rounded-none" />
          </div>
        </GhostSurface>
      ))}
    </div>

    <section className="space-y-3">
      <GhostBlock className="h-7 w-36 rounded-none" />
      <GhostSurface className="overflow-hidden p-0">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`issue-${index}`} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
              <GhostBlock className="h-6 w-24 rounded-none" />
              <div className="min-w-0 flex-1 space-y-2">
                <GhostBlock className="h-4 w-3/4 max-w-md rounded-none" />
                <GhostBlock className="h-3 w-full max-w-lg rounded-none" />
              </div>
              <GhostBlock className="hidden h-10 w-28 rounded-none md:block" />
            </div>
          ))}
        </div>
      </GhostSurface>
    </section>

    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <GhostBlock className="h-7 w-28 rounded-none" />
        <GhostBlock className="h-6 w-20 rounded-none" />
      </div>
      <div className="flex gap-3 overflow-hidden pb-1">
        {Array.from({ length: 3 }).map((_, index) => (
          <GhostSurface key={`top-user-${index}`} className="h-[200px] min-w-[300px] shrink-0 p-4">
            <div className="flex gap-3">
              <GhostBlock className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <GhostBlock className="h-4 w-full rounded-none" />
                <GhostBlock className="h-3 w-2/3 rounded-none" />
              </div>
            </div>
            <GhostBlock className="mt-4 h-24 w-full rounded-xl" />
          </GhostSurface>
        ))}
      </div>
    </section>

    <section className="space-y-3">
      <div className="space-y-2">
        <GhostBlock className="h-7 w-52 rounded-none" />
        <GhostBlock className="h-3 w-full max-w-xl rounded-none" />
      </div>
      <div className="flex gap-3 overflow-hidden pb-1">
        {Array.from({ length: 3 }).map((_, index) => (
          <GhostSurface key={`rec-${index}`} className="h-[220px] min-w-[280px] shrink-0 p-4">
            <GhostBlock className="h-5 w-32 rounded-none" />
            <GhostBlock className="mt-3 h-3 w-full rounded-none" />
            <GhostBlock className="mt-4 h-28 w-full rounded-none" />
          </GhostSurface>
        ))}
      </div>
    </section>
  </div>
);

const AnalyticsGhostBody: React.FC<{ kpiCount?: number }> = ({ kpiCount = 4 }) => (
  <div className="mx-auto w-full max-w-[1600px] space-y-6 px-6 py-6">
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {Array.from({ length: kpiCount }).map((_, index) => (
        <GhostSurface key={index} className="px-4 py-4">
          <GhostBlock className="h-3 w-24 rounded-none" />
          <GhostBlock className="mt-4 h-8 w-20 rounded-none" />
          <GhostBlock className="mt-3 h-3 w-28 rounded-none" />
        </GhostSurface>
      ))}
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <GhostSurface className="min-h-[320px]">
        <GhostBlock className="h-5 w-44 rounded-none" />
        <GhostBlock className="mt-4 h-56 w-full rounded-none" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <GhostBlock key={index} className="h-14 rounded-none" />
          ))}
        </div>
      </GhostSurface>
      <GhostSurface className="min-h-[320px]">
        <GhostBlock className="h-5 w-36 rounded-none" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <GhostBlock className="h-4 w-32 rounded-none" />
              <GhostBlock className="h-4 w-16 rounded-none" />
            </div>
          ))}
        </div>
        <GhostBlock className="mt-6 h-28 w-full rounded-none" />
      </GhostSurface>
    </div>

    <GhostSurface className="min-h-[280px]">
      <GhostBlock className="h-5 w-40 rounded-none" />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GhostBlock className="h-44 rounded-none lg:col-span-2" />
        <div className="space-y-4">
          <GhostBlock className="h-20 rounded-none" />
          <GhostBlock className="h-20 rounded-none" />
        </div>
      </div>
    </GhostSurface>
  </div>
);

const ListGhostBody: React.FC = () => (
  <div className="mx-auto w-full max-w-[1800px] space-y-4 px-6 py-6">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <GhostSurface key={index} className="p-4">
          <GhostBlock className="h-3 w-24 rounded-none" />
          <GhostBlock className="mt-3 h-8 w-16 rounded-none" />
        </GhostSurface>
      ))}
    </div>

    <GhostSurface className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-white/55 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <GhostBlock className="h-10 min-w-[240px] flex-1 rounded-none" />
          <GhostBlock className="h-10 w-36 rounded-none" />
          <GhostBlock className="h-10 w-28 rounded-none" />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-6 py-4">
            <GhostBlock className="h-8 w-8 rounded-none" />
            <div className="min-w-0 flex-1 space-y-2">
              <GhostBlock className="h-4 w-48 rounded-none" />
              <GhostBlock className="h-3 w-72 max-w-full rounded-none" />
            </div>
            <GhostBlock className="hidden h-8 w-20 rounded-none md:block" />
            <GhostBlock className="hidden h-8 w-16 rounded-none md:block" />
            <GhostBlock className="h-9 w-24 rounded-none" />
          </div>
        ))}
      </div>
    </GhostSurface>
  </div>
);

const MapGhostBody: React.FC = () => (
  <div className="relative flex-1 w-full bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),_rgba(248,250,252,0.92)_48%,_rgba(241,245,249,0.86)_100%)]">
    <div className="absolute left-6 right-6 top-6 z-10 flex flex-wrap gap-3">
      <GhostBlock className="h-16 w-44 rounded-none" />
      <GhostBlock className="h-16 w-44 rounded-none" />
      <GhostBlock className="h-16 w-36 rounded-none" />
    </div>
    <div className="absolute inset-0 p-6">
      <GhostBlock className="h-full w-full rounded-none" />
    </div>
  </div>
);

const SettingsGhostBody: React.FC = () => (
  <div className="mx-auto flex-1 w-full max-w-[1600px] space-y-8 px-6 py-6 md:px-8">
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <GhostSurface className="space-y-4 lg:col-span-2">
        <GhostBlock className="h-5 w-36 rounded-none" />
        <GhostBlock className="h-32 w-full rounded-none" />
        <GhostBlock className="h-56 w-full rounded-none" />
      </GhostSurface>
      <div className="space-y-6">
        <GhostSurface>
          <GhostBlock className="h-5 w-28 rounded-none" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <GhostBlock key={index} className="h-10 w-full rounded-none" />
            ))}
          </div>
        </GhostSurface>
        <GhostSurface>
          <GhostBlock className="h-5 w-24 rounded-none" />
          <GhostBlock className="mt-4 h-24 w-full rounded-none" />
        </GhostSurface>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <GhostSurface className="min-h-[220px]">
        <GhostBlock className="h-5 w-32 rounded-none" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <GhostBlock key={index} className="h-10 w-full rounded-none" />
          ))}
        </div>
      </GhostSurface>
      <GhostSurface className="min-h-[220px]">
        <GhostBlock className="h-5 w-32 rounded-none" />
        <GhostBlock className="mt-4 h-40 w-full rounded-none" />
      </GhostSurface>
    </div>
  </div>
);

const AlertsGhostBody: React.FC = () => (
  <div className="mx-auto w-full max-w-[1200px] space-y-8 px-8 py-8 pb-12">
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <GhostSurface className="min-h-[260px]">
        <GhostBlock className="h-5 w-40 rounded-none" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <GhostBlock key={index} className="h-14 w-full rounded-none" />
          ))}
        </div>
      </GhostSurface>
      <GhostSurface className="min-h-[260px]">
        <GhostBlock className="h-5 w-36 rounded-none" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <GhostBlock key={index} className="h-12 w-full rounded-none" />
          ))}
        </div>
      </GhostSurface>
    </div>

    <GhostSurface className="overflow-hidden p-0">
      <div className="border-b border-slate-100 bg-white/55 px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <GhostBlock className="h-10 min-w-[220px] flex-1 rounded-none" />
          <GhostBlock className="h-10 w-32 rounded-none" />
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <GhostBlock className="h-4 w-48 rounded-none" />
              <GhostBlock className="h-3 w-64 max-w-full rounded-none" />
            </div>
            <GhostBlock className="h-9 w-24 rounded-none" />
          </div>
        ))}
      </div>
    </GhostSurface>
  </div>
);

export const DashboardGhostLoader: React.FC<DashboardGhostLoaderProps> = ({ variant = 'analytics' }) => {
  if (variant === 'general') {
    return (
      <div className="min-h-screen bg-transparent pb-12 font-sans text-black">
        <GeneralPageHeaderGhost />
        <GeneralGhostBody />
      </div>
    );
  }

  if (variant === 'settings') {
    return (
      <div className="min-h-screen bg-white font-sans text-black">
        <SettingsHeaderGhost />
        <SettingsGhostBody />
      </div>
    );
  }

  if (variant === 'map') {
    return (
      <div className="flex min-h-screen flex-col bg-transparent font-sans text-black">
        <DashboardHeaderGhost actionCount={1} />
        <MapGhostBody />
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="min-h-screen bg-transparent font-sans text-black">
        <DashboardHeaderGhost />
        <ListGhostBody />
      </div>
    );
  }

  if (variant === 'alerts') {
    return (
      <div className="min-h-screen bg-slate-50 font-sans text-black">
        <DashboardHeaderGhost actionCount={1} />
        <AlertsGhostBody />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent font-sans text-black">
      <DashboardHeaderGhost />
      <AnalyticsGhostBody kpiCount={4} />
    </div>
  );
};

export default DashboardGhostLoader;
