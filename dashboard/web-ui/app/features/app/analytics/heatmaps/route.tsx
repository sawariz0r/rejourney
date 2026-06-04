import React from 'react';
import { DashboardLensControls } from '~/shared/ui/core/DashboardLensControls';
import { DashboardPageHeader } from '~/shared/ui/core/DashboardPageHeader';
import { dashboardPageHeaderProps } from '~/shell/navigation/dashboardPageMeta';
import { TouchHeatmapSection } from '~/features/app/shared/dashboard/TouchHeatmapSection';
import { useSharedRejourneyTimeRange } from '~/shared/hooks/useSharedRejourneyTimeRange';
import { platformLensToSessionPlatform, useSharedPlatformLens } from '~/shared/hooks/useSharedPlatformLens';
import { useSessionData } from '~/shared/providers/SessionContext';

export const Heatmaps: React.FC = () => {
    const { selectedProject } = useSessionData();
    const { timeRange, setTimeRange } = useSharedRejourneyTimeRange(selectedProject?.id);
    const { platformLens } = useSharedPlatformLens(selectedProject?.id, selectedProject?.platforms);
    const platform = platformLensToSessionPlatform(platformLens);

    return (
        <div className="rejourney-heatmaps-page flex min-h-screen flex-col pb-10 font-sans text-slate-950 xl:h-full xl:min-h-0 xl:overflow-hidden xl:pb-0">
            <DashboardPageHeader
                title="Heat Maps"
                {...dashboardPageHeaderProps('heatmaps')}
            >
                <DashboardLensControls
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                />
            </DashboardPageHeader>

            <div className="heatmap-page-main mx-auto flex w-full max-w-[1900px] flex-1 flex-col px-3 py-4 sm:px-5 lg:px-6 xl:min-h-0 xl:py-3">
                <TouchHeatmapSection timeRange={timeRange} platform={platform} compact={false} className="xl:min-h-0 xl:flex-1" />
            </div>
        </div>
    );
};

export default Heatmaps;
