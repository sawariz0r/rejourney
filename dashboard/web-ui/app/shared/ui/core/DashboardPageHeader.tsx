import React from 'react';

interface DashboardPageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    iconColor?: string;
    children?: React.ReactNode;
}

export const DashboardPageHeader: React.FC<DashboardPageHeaderProps> = ({
    title,
    subtitle,
    icon,
    iconColor = 'bg-white', // Default to white if not provided
    children
}) => {
    const isLightIconBackground = /-(50|100|200)\b/.test(iconColor) || iconColor.includes('white');
    const iconToneClass = iconColor.includes('black')
        ? 'text-white'
        : isLightIconBackground
            ? 'text-black'
            : 'text-black';

    return (
        <div className="w-full border-b-2 border-black bg-[#f8fafc]">
            <div className="mx-auto grid w-full max-w-[1800px] gap-x-4 gap-y-2 px-3 py-2.5 sm:px-6 sm:py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                <div className="flex min-w-0 flex-wrap items-start gap-3 sm:gap-4">
                    {icon && (
                        <div className={`mt-0.5 shrink-0 border-2 border-black p-2.5 shadow-neo-sm ${iconColor} ${iconToneClass}`}>
                            {icon}
                        </div>
                    )}
                    <div className="min-w-0 flex-1" style={{ minWidth: 'min(100%, 13rem)' }}>
                        <h1 className="text-xl font-black uppercase leading-tight text-black sm:text-2xl">
                            {title}
                        </h1>
                        {subtitle && (
                            <div className="mt-1.5 flex min-w-0 items-start gap-2 opacity-80">
                                <p className="max-w-3xl text-xs font-semibold leading-5 text-slate-600 sm:text-sm">
                                    {subtitle}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2 sm:gap-3 xl:justify-end">
                    {children}
                </div>
            </div>
        </div>
    );
};
