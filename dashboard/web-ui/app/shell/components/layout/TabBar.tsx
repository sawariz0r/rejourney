import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTabs } from '~/shared/providers/TabContext';
import { useSessionData } from '~/shared/providers/SessionContext';
import {
    Plus,
    X,
    Trash2,
    Layers,
    Undo2,
    PanelRightClose,
    SplitSquareVertical,
    FileText
} from 'lucide-react';

interface TabBarProps {
    pathPrefix?: string;
    group?: 'primary' | 'secondary';
}

const STALE_TAB_KEEP_COUNT = 6;
const TAB_DRAG_MIME = 'application/x-rejourney-tab-id';

type TabThemeKey =
    | 'general'
    | 'sessions'
    | 'api'
    | 'journeys'
    | 'heatmaps'
    | 'devices'
    | 'geo'
    | 'stability'
    | 'crashes'
    | 'anrs'
    | 'errors'
    | 'alerts'
    | 'settings'
    | 'search'
    | 'other';

type TabTheme = {
    shortLabel: string;
    accent: string;
    badgeBg: string;
    badgeText: string;
    idleBg: string;
    idleHoverBg: string;
};

const TAB_THEME_MAP: Record<TabThemeKey, TabTheme> = {
    general: {
        shortLabel: 'GEN',
        accent: '#67e8f9',
        badgeBg: '#cffafe',
        badgeText: '#0f172a',
        idleBg: '#ecfeff',
        idleHoverBg: '#cffafe',
    },
    sessions: {
        shortLabel: 'RPL',
        accent: '#67e8f9',
        badgeBg: '#cffafe',
        badgeText: '#0f172a',
        idleBg: '#ecfeff',
        idleHoverBg: '#cffafe',
    },
    api: {
        shortLabel: 'API',
        accent: '#86efac',
        badgeBg: '#d1fae5',
        badgeText: '#0f172a',
        idleBg: '#ecfdf5',
        idleHoverBg: '#d1fae5',
    },
    journeys: {
        shortLabel: 'JRN',
        accent: '#f9a8d4',
        badgeBg: '#fce7f3',
        badgeText: '#0f172a',
        idleBg: '#fdf2f8',
        idleHoverBg: '#fce7f3',
    },
    heatmaps: {
        shortLabel: 'HEA',
        accent: '#f9a8d4',
        badgeBg: '#fce7f3',
        badgeText: '#0f172a',
        idleBg: '#f8fafc',
        idleHoverBg: '#fce7f3',
    },
    devices: {
        shortLabel: 'DEV',
        accent: '#c4b5fd',
        badgeBg: '#e0e7ff',
        badgeText: '#0f172a',
        idleBg: '#eef2ff',
        idleHoverBg: '#e0e7ff',
    },
    geo: {
        shortLabel: 'GEO',
        accent: '#5dadec',
        badgeBg: '#dbeafe',
        badgeText: '#0f172a',
        idleBg: '#eff6ff',
        idleHoverBg: '#dbeafe',
    },
    stability: {
        shortLabel: 'STB',
        accent: '#f97316',
        badgeBg: '#ffedd5',
        badgeText: '#0f172a',
        idleBg: '#fff7ed',
        idleHoverBg: '#ffedd5',
    },
    crashes: {
        shortLabel: 'CRH',
        accent: '#fb7185',
        badgeBg: '#ffe4e6',
        badgeText: '#0f172a',
        idleBg: '#fff1f2',
        idleHoverBg: '#ffe4e6',
    },
    anrs: {
        shortLabel: 'ANR',
        accent: '#c4b5fd',
        badgeBg: '#ede9fe',
        badgeText: '#0f172a',
        idleBg: '#f5f3ff',
        idleHoverBg: '#ede9fe',
    },
    errors: {
        shortLabel: 'ERR',
        accent: '#f9a8d4',
        badgeBg: '#fce7f3',
        badgeText: '#0f172a',
        idleBg: '#f8fafc',
        idleHoverBg: '#fce7f3',
    },
    alerts: {
        shortLabel: 'ALT',
        accent: '#fca5a5',
        badgeBg: '#fee2e2',
        badgeText: '#0f172a',
        idleBg: '#fef2f2',
        idleHoverBg: '#fee2e2',
    },
    settings: {
        shortLabel: 'CFG',
        accent: '#f4f4f5',
        badgeBg: '#f4f4f5',
        badgeText: '#0f172a',
        idleBg: '#fafafa',
        idleHoverBg: '#f4f4f5',
    },
    search: {
        shortLabel: 'NEW',
        accent: '#000000',
        badgeBg: '#f8fafc',
        badgeText: '#0f172a',
        idleBg: '#f8fafc',
        idleHoverBg: '#ecfeff',
    },
    other: {
        shortLabel: 'TAB',
        accent: '#000000',
        badgeBg: '#f8fafc',
        badgeText: '#0f172a',
        idleBg: '#f8fafc',
        idleHoverBg: '#ecfeff',
    },
};

function compactLabel(value?: string | null, fallback: string = 'Unknown'): string {
    if (!value) return fallback;
    return value.length > 22 ? `${value.slice(0, 20)}...` : value;
}

function stripPathPrefix(pathname: string): string {
    return pathname.replace(/^\/(dashboard|demo)/, '');
}

function getTabThemeKey(path: string, tabId: string): TabThemeKey {
    const normalizedPath = stripPathPrefix(path);

    if (normalizedPath.startsWith('/analytics/api')) return 'api';
    if (normalizedPath.startsWith('/analytics/journeys')) return 'journeys';
    if (normalizedPath.startsWith('/analytics/heatmaps')) return 'heatmaps';
    if (normalizedPath.startsWith('/analytics/devices')) return 'devices';
    if (normalizedPath.startsWith('/analytics/geo')) return 'geo';
    if (normalizedPath.startsWith('/sessions')) return 'sessions';
    if (normalizedPath.startsWith('/alerts')) return 'alerts';
    if (normalizedPath === '/stability') return 'stability';
    if (normalizedPath.startsWith('/stability/crashes')) return 'crashes';
    if (normalizedPath.startsWith('/stability/anrs')) return 'anrs';
    if (normalizedPath.startsWith('/stability/errors')) return 'errors';
    if (
        normalizedPath.startsWith('/settings')
        || normalizedPath.startsWith('/team')
        || normalizedPath.startsWith('/account')
        || normalizedPath.startsWith('/billing')
    ) return 'settings';
    if (normalizedPath.startsWith('/search')) return 'search';
    if (normalizedPath.startsWith('/general') || normalizedPath.startsWith('/issues')) return 'general';

    if (tabId.startsWith('session-')) return 'sessions';
    if (tabId.startsWith('crash-')) return 'crashes';
    if (tabId.startsWith('anr-')) return 'anrs';
    if (tabId.startsWith('error-')) return 'errors';
    if (tabId.startsWith('issue-')) return 'general';

    return 'other';
}

export const TabBar: React.FC<TabBarProps> = ({ pathPrefix = '', group = 'primary' }) => {
    const {
        tabs,
        activeTabId,
        secondaryTabId,
        setActiveTabId,
        closeTab,
        reorderTabs,
        closeAllTabs,
        closeOtherTabs,
        closeStaleTabs,
        reopenTab,
        openTabInSplit,
        moveTabToGroup,
        recentlyClosed,
        isSplitView,
        closeSplitView,
    } = useTabs();
    const { selectedProject } = useSessionData();
    const navigate = useNavigate();

    const groupTabs = tabs.filter(t => t.group === group);
    const activeId = group === 'primary' ? activeTabId : secondaryTabId;

    const draggedItem = useRef<number | null>(null);
    const tabScrollRef = useRef<HTMLDivElement | null>(null);
    const tabElementRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

    const closableTabs = tabs.filter((tab) => tab.isClosable).length;
    const canReopen = recentlyClosed.length > 0;
    const canCloseStale = closableTabs > STALE_TAB_KEEP_COUNT;
    const tabOrderKey = groupTabs.map((tab) => tab.id).join('|');

    useEffect(() => {
        if (!activeId) return;
        const activeTabElement = tabElementRefs.current[activeId];
        if (!activeTabElement) return;
        activeTabElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
        });
    }, [activeId, tabOrderKey]);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number, tabId: string) => {
        draggedItem.current = index;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(TAB_DRAG_MIME, tabId);
        e.dataTransfer.setData('text/plain', tabId);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.preventDefault();
        // If we need to support dragging from simple external sources, we might need checks here.
        // But for internal tab dragging:
        setDragOverIndex(index);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
        e.preventDefault();
        const tabId = e.dataTransfer.getData(TAB_DRAG_MIME);
        if (!tabId) return;

        const draggingTab = tabs.find(t => t.id === tabId);
        if (!draggingTab) return;

        if (draggingTab.group !== group) {
            // Moved to a different group!
            moveTabToGroup(tabId, group);
        } else {
            // Reordering within same group
            const sourceIndex = groupTabs.findIndex(t => t.id === tabId);
            if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
                reorderTabs(sourceIndex, targetIndex, group);
            }
        }

        draggedItem.current = null;
        setDragOverIndex(null);
    };

    const handleDragEnd = () => {
        draggedItem.current = null;
        setDragOverIndex(null);
    };

    const handleTabClick = (tab: { id: string; path: string }) => {
        if (group === 'primary') {
            setActiveTabId(tab.id);
            navigate(tab.path);
        } else {
            // For secondary, we just set the secondary focus (context handles this usually via setSecondaryTabId)
            // But we need to expose a way to set it active specific to that pane?
            // TabContext's `openTab` or similar usually handles ID setting.
            // Let's use `moveTabToGroup` logic helper or add `setSecondaryTabId` to context export?
            // Actually `activeTabId` in context is GLOBAL active.
            // We need a way to say "This secondary tab is visible".
            // `moveTabToGroup` logic handles checks.
            // We can just call `moveTabToGroup` with same group and it handles secondary ID update?
            moveTabToGroup(tab.id, 'secondary');
        }
    };

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ id, x: e.clientX, y: e.clientY });
    };

    const handleCloseOthers = (id: string) => {
        closeOtherTabs(id);
        setContextMenu(null);
    };

    const handleCloseAll = () => {
        if (confirm('Are you sure you want to close all tabs?')) {
            closeAllTabs();
        }
        setContextMenu(null);
    };

    const handleReopen = () => {
        reopenTab();
        setContextMenu(null);
    };

    const handleCloseStale = () => {
        closeStaleTabs();
        setContextMenu(null);
    };

    const handleCloseSplit = () => {
        closeSplitView();
        setContextMenu(null);
    };

    const handleNewTab = () => {
        // New tab always goes to primary
        navigate(`${pathPrefix}/search`);
    };

    const handleTabStripWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const container = tabScrollRef.current;
        if (!container || container.scrollWidth <= container.clientWidth) return;

        const delta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
        if (Math.abs(delta) < 0.5) return;

        event.preventDefault();
        container.scrollLeft += delta;
    };

    return (
        <div
            className="dashboard-tabbar flex min-w-0 items-end border-b-2 border-black bg-[#f8fafc] px-2 pt-1"
            onClick={() => setContextMenu(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                // Handle drop on empty space (append)
                e.preventDefault();
                const tabId = e.dataTransfer.getData(TAB_DRAG_MIME);
                if (tabId) {
                    moveTabToGroup(tabId, group);
                }
            }}
        >
            <div className="min-w-0 flex-1 overflow-hidden">
                <div
                    ref={tabScrollRef}
                    className="flex w-full items-end gap-[3px] overflow-x-auto overflow-y-hidden no-scrollbar"
                    onWheel={handleTabStripWheel}
                >
                    {groupTabs.map((tab, index) => {
                        const isActive = tab.id === activeId;
                        const isDraggingOver = dragOverIndex === index;
                        const projectLabel = compactLabel(tab.projectName || selectedProject?.name, 'Project');
                        const TabIcon = tab.icon || FileText;
                        const theme = TAB_THEME_MAP[getTabThemeKey(tab.path, tab.id)];
                        const tabStyle: React.CSSProperties = {
                            backgroundColor: isDraggingOver ? theme.idleHoverBg : 'transparent',
                            borderColor: 'transparent',
                            boxShadow: isActive
                                ? `inset 0 -3px 0 0 ${theme.accent}`
                                : 'none',
                        };

                        return (
                            <div
                                key={tab.id}
                                ref={(node) => {
                                    tabElementRefs.current[tab.id] = node;
                                }}
                                draggable
                                data-tab-id={tab.id}
                                onDragStart={(e) => handleDragStart(e, index, tab.id)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                                onClick={() => handleTabClick(tab)}
                                onContextMenu={(e) => handleContextMenu(e, tab.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={[
                                    'group relative flex h-10 min-w-[112px] max-w-[220px] shrink-0 cursor-pointer select-none items-center gap-2 border border-transparent px-3 text-[12px] transition-all',
                                    isActive
                                        ? 'z-[1] font-semibold text-[#202124]'
                                        : 'z-0 font-medium text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]',
                                ].join(' ')}
                                style={tabStyle}
                                title={`Project: ${projectLabel}\n${tab.title}`}
                            >
                                <TabIcon
                                    className={`h-3.5 w-3.5 shrink-0 stroke-[2.4] ${isActive ? 'text-[#1a73e8]' : 'text-[#5f6368]'}`}
                                    style={{ color: isActive ? theme.accent : undefined }}
                                />
                                <div className="min-w-0 flex-1 truncate leading-none">
                                    <span className="truncate">
                                        {tab.title}
                                    </span>
                                </div>

                                <div className={`flex shrink-0 items-center ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                    {tab.isClosable && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                closeTab(tab.id, e);
                                            }}
                                            className="flex h-5 w-5 items-center justify-center border border-transparent text-slate-700 transition-colors hover:border-black hover:bg-[#fecaca] hover:text-red-700"
                                            title="Close tab"
                                        >
                                            <X className="h-3 w-3 stroke-[3]" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {groupTabs.length === 0 && (
                        <div className="px-4 py-2 text-xs font-semibold text-slate-500">No open tabs</div>
                    )}
                    {group === 'primary' && (
                        <button
                            onClick={handleNewTab}
                            className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-transparent bg-transparent text-[#5f6368] transition-colors hover:bg-[#f1f3f4] hover:text-[#202124]"
                            title="New tab"
                        >
                            <Plus className="h-4 w-4 stroke-[2.5]" />
                        </button>
                    )}
                </div>
            </div>

            {/* Controls Area */}
            <div className="ml-2 flex shrink-0 items-center gap-1 border-l border-[#dadce0] pl-2">
                {group === 'primary' && (
                    <>
                        <button
                            onClick={handleReopen}
                            disabled={!canReopen}
                            className={[
                                'flex h-8 w-8 items-center justify-center rounded-full border border-transparent transition-colors',
                                canReopen ? 'text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]' : 'cursor-not-allowed text-slate-300'
                            ].join(' ')}
                            title={canReopen ? 'Reopen closed tab' : 'No recently closed tabs'}
                        >
                            <Undo2 className="h-4 w-4 stroke-[3]" />
                        </button>

                        <button
                            onClick={handleCloseStale}
                            disabled={!canCloseStale}
                            className={[
                                'flex h-8 w-8 items-center justify-center rounded-full border border-transparent transition-colors',
                                canCloseStale ? 'text-[#5f6368] hover:bg-[#f1f3f4] hover:text-[#202124]' : 'cursor-not-allowed text-slate-300'
                            ].join(' ')}
                            title={canCloseStale ? 'Close stale tabs' : 'No stale tabs'}
                        >
                            <Layers className="h-4 w-4 stroke-[3]" />
                        </button>
                    </>
                )}

                {isSplitView && group === 'secondary' && (
                    <button
                        onClick={handleCloseSplit}
                        className="flex h-7 w-7 items-center justify-center border-2 border-transparent text-black transition-colors hover:border-black hover:bg-white"
                        title="Close split view"
                    >
                        <PanelRightClose className="h-4 w-4 stroke-[3]" />
                    </button>
                )}

                <button
                    onClick={handleCloseAll}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-[#5f6368] transition-colors hover:bg-[#fce8e6] hover:text-[#d93025]"
                    title="Close all tabs"
                >
                    <Trash2 className="h-4 w-4 stroke-[3]" />
                </button>
            </div>

            {contextMenu && (
                <div
                    className="fixed z-[100] min-w-[180px] border-2 border-black bg-white py-1 text-xs font-bold shadow-neo"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#ecfeff]"
                        onClick={() => {
                            closeTab(contextMenu.id);
                            setContextMenu(null);
                        }}
                    >
                        Close Tab
                        <X className="h-3 w-3" />
                    </button>

                    <button
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#ecfeff]"
                        onClick={() => {
                            openTabInSplit(contextMenu.id);
                            setContextMenu(null);
                        }}
                    >
                        Open In Split Pane
                        <SplitSquareVertical className="h-3 w-3" />
                    </button>

                    <button
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#ecfeff]"
                        onClick={() => handleCloseOthers(contextMenu.id)}
                    >
                        Close Others
                        <X className="h-3 w-3" />
                    </button>

                    <div className="mx-1 my-1 h-px bg-black/20" />

                    <button
                        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#fecaca] text-red-600"
                        onClick={handleCloseAll}
                    >
                        Close All
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            )}
        </div>
    );
};
