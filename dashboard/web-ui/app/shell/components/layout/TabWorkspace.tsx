import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { SplitSquareVertical } from 'lucide-react';
import { TabRegistry } from '~/shell/tabs/TabRegistry';
import { useTabs } from '~/shared/providers/TabContext';
import { ErrorBoundary as ClientErrorBoundary } from '~/shared/ui/core/ErrorBoundary';
import { TabBar } from './TabBar';

interface TabWorkspaceProps {
    children: React.ReactNode;
}

const TAB_DRAG_MIME = 'application/x-rejourney-tab-id';
const PANE_ERROR_FALLBACK_CLASS = 'flex h-full min-h-[360px] items-center justify-center bg-background p-8';

function stripPathPrefix(pathname: string): string {
    return pathname.replace(/^\/(dashboard|demo)/, '') || '/general';
}

function extractDraggedTabId(event: React.DragEvent): string {
    return event.dataTransfer.getData(TAB_DRAG_MIME) || event.dataTransfer.getData('text/plain');
}

function getPaneBodyClass(routeWithoutPrefix: string): string {
    const usesViewportFit = routeWithoutPrefix.startsWith('/analytics/heatmaps');
    const desktopOverflow = usesViewportFit
        ? 'overflow-y-auto pb-10 xl:overflow-hidden xl:pb-0'
        : 'overflow-y-auto pb-10';

    return `relative flex-1 min-h-0 overflow-x-hidden pt-0 ${desktopOverflow}`;
}

export const TabWorkspace: React.FC<TabWorkspaceProps> = ({ children }) => {
    const {
        tabs,
        isSplitView,
        secondaryTabId,
        splitRatio,
        openTabInSplit,
        setSplitRatio,
    } = useTabs();

    const navigate = useNavigate();
    const location = useLocation();
    const routeWithoutPrefix = useMemo(() => stripPathPrefix(location.pathname), [location.pathname]);
    const tabPathPrefix = useMemo(() => (location.pathname.startsWith('/demo') ? '/demo' : '/dashboard'), [location.pathname]);
    const hideTabChrome = routeWithoutPrefix.startsWith('/warehouse');
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const primaryScrollRef = useRef<HTMLDivElement | null>(null);
    const secondaryScrollRef = useRef<HTMLDivElement | null>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [isSplitDropActive, setIsSplitDropActive] = useState(false);

    const secondaryTab = secondaryTabId ? tabs.find((tab) => tab.id === secondaryTabId) || null : null;
    const canSplit = tabs.length > 1;

    const secondaryTabDefinition = useMemo(() => {
        if (!secondaryTab) return null;
        return TabRegistry.resolve(stripPathPrefix(secondaryTab.path));
    }, [secondaryTab]);
    const secondaryRouteWithoutPrefix = secondaryTab ? stripPathPrefix(secondaryTab.path) : '';
    const primaryPaneBodyClass = getPaneBodyClass(routeWithoutPrefix);
    const secondaryPaneBodyClass = getPaneBodyClass(secondaryRouteWithoutPrefix);
    const primaryPaneKey = `${location.pathname}${location.search}`;
    const primaryPaneContent = (
        <ClientErrorBoundary key={`primary:${primaryPaneKey}`} fallbackClassName={PANE_ERROR_FALLBACK_CLASS}>
            {children}
        </ClientErrorBoundary>
    );

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (event: MouseEvent) => {
            const container = splitContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            if (rect.width <= 0) return;
            const ratio = (event.clientX - rect.left) / rect.width;
            setSplitRatio(ratio);
        };

        const handleMouseUp = () => setIsResizing(false);

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, setSplitRatio]);

    // Each dashboard page should open from the top when route changes.
    useEffect(() => {
        const container = primaryScrollRef.current;
        if (!container) return;
        container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname]);

    // Secondary pane also resets when switching which tab it renders.
    useEffect(() => {
        const container = secondaryScrollRef.current;
        if (!container) return;
        container.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [secondaryTabId]);

    const handleDropToSplit = (event: React.DragEvent) => {
        event.preventDefault();
        const tabId = extractDraggedTabId(event);
        if (!tabId) return;
        openTabInSplit(tabId);
        setIsSplitDropActive(false);
    };

    if (hideTabChrome) {
        return (
            <div className="flex h-full min-h-0 flex-col bg-transparent">
                <div className="min-h-0 flex-1 overflow-hidden">{primaryPaneContent}</div>
            </div>
        );
    }

    if (!isSplitView || !secondaryTab) {
        return (
            <div className="flex flex-col h-full min-h-0 bg-transparent">
                <TabBar group="primary" pathPrefix={tabPathPrefix} />
                <div
                    className={primaryPaneBodyClass}
                    ref={primaryScrollRef}
                    onDragOver={(event) => {
                        const tabId = extractDraggedTabId(event);
                        if (!tabId || !canSplit) return;
                        event.preventDefault();
                        setIsSplitDropActive(true);
                    }}
                    onDragLeave={() => setIsSplitDropActive(false)}
                    onDrop={handleDropToSplit}
                >
                    {primaryPaneContent}
                    {isSplitDropActive && canSplit && (
                        <div className="absolute inset-0 z-20 border-2 border-dashed border-sky-400 bg-sky-50/70 pointer-events-none">
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-5 py-3 text-xs font-semibold text-sky-700 shadow-sm">
                                    <SplitSquareVertical className="h-4 w-4" />
                                    Drop tab to create split view
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const SecondaryComponent = secondaryTabDefinition?.Component;

    // In split view, we render two panes, each with a TabBar.
    return (
        <div ref={splitContainerRef} className="flex flex-1 min-h-0 bg-transparent h-full">
            {/* Primary Pane */}
            <section className="flex min-w-0 flex-col border-r border-slate-200 h-full" style={{ width: `${splitRatio * 100}%` }}>
                <TabBar group="primary" pathPrefix={tabPathPrefix} />
                <div ref={primaryScrollRef} className={primaryPaneBodyClass}>
                    {primaryPaneContent}
                </div>
            </section>

            {/* Resizer */}
            <div
                className={`w-1 cursor-col-resize border-x border-slate-200 bg-slate-100 hover:bg-sky-300 hover:border-sky-300 transition-colors z-10 ${isResizing ? 'bg-sky-400 border-sky-400' : ''}`}
                onMouseDown={() => setIsResizing(true)}
                title="Drag to resize panes"
            />

            {/* Secondary Pane */}
            <section className="flex min-w-0 flex-col h-full" style={{ width: `${(1 - splitRatio) * 100}%` }}>
                <TabBar group="secondary" pathPrefix={tabPathPrefix} />
                <div ref={secondaryScrollRef} className={`${secondaryPaneBodyClass} bg-transparent`}>
                    {SecondaryComponent && secondaryTabDefinition ? (
                        <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-slate-500">Loading tab…</div>}>
                            <ClientErrorBoundary key={`secondary:${secondaryTab.id}:${secondaryTab.path}`} fallbackClassName={PANE_ERROR_FALLBACK_CLASS}>
                                <SecondaryComponent {...(secondaryTabDefinition.props || {})} />
                            </ClientErrorBoundary>
                        </Suspense>
                    ) : (
                        <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            Unable to render secondary tab. Open it as primary and retry.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
