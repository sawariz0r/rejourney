import React from 'react';
import { LucideIcon } from 'lucide-react';
import { NeoBadge } from '~/shared/ui/core/neo/NeoBadge';

interface PageHeaderProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    badge?: {
        label: string;
        variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
    };
    actions?: React.ReactNode;
    iconClassName?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    badge,
    actions,
}) => {
    return (
        <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
            <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 md:flex-row md:items-center">
                <div className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden="true" className="h-5 w-1.5 shrink-0 border border-black/20 bg-[#67e8f9]" />
                    <div className="min-w-0">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            <h1 className="truncate text-[15px] font-extrabold uppercase leading-none text-slate-950 sm:text-base">
                                {title}
                            </h1>
                            {badge && (
                                <NeoBadge variant={badge.variant || 'neutral'}>
                                    {badge.label}
                                </NeoBadge>
                            )}
                        </div>
                        {subtitle && (
                            <p className="max-w-2xl text-xs font-medium leading-4 text-slate-600">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
};
