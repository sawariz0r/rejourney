import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SankeyFlow {
    from: string;
    to: string;
    count: number;
    crashCount: number;
    anrCount: number;
    apiErrorRate: number;
    rageTapCount: number;
    apiErrors?: number;
    avgApiLatencyMs?: number;
    health?: 'healthy' | 'degraded' | 'problematic';
    replayCount?: number;
    sampleSessionIds?: string[];
    isAggregate?: boolean;
    aggregateFlowCount?: number;
}

export interface SankeyEvidenceSession {
    sessionId: string;
    source: string;
    signal: string;
    priority?: 'high' | 'medium' | 'low';
}

export interface SankeyVersionOption {
    version: string;
    count: number;
}

interface SankeyNode {
    id: string;
    name: string;
    level: number;
    y: number;
    cardY: number;
    barY: number;
    barHeight: number;
    outValue: number;
    inValue: number;
    totalValue: number;
}

interface SankeyLink {
    id: string;
    source: string;
    target: string;
    value: number;
    ySource: number;
    yTarget: number;
    thickness: number;
    data: SankeyFlow;
}

interface SankeyJourneyProps {
    flows: SankeyFlow[];
    width?: number;
    height?: number;
    happyPath?: string[] | null;
    selectedTransitionIds?: string[];
    onFlowToggle?: (flow: SankeyFlow) => void;
    appVersions?: SankeyVersionOption[];
    selectedAppVersion?: string | null;
    onAppVersionChange?: (version: string | null) => void;
}

const interpolateChannel = (from: number, to: number, amount: number): number => Math.round(from + (to - from) * amount);

const sankeyPalette = [
    [93, 173, 236],
    [44, 48, 56],
    [99, 102, 241],
    [34, 197, 94],
    [251, 146, 60],
    [239, 68, 68],
    [20, 184, 166],
    [234, 179, 8],
    [217, 70, 239],
    [14, 165, 233],
] as const;

const ALL_APP_VERSIONS_VALUE = '__all_app_versions__';

const getStableColorIndex = (value: string): number => {
    const normalized = value.toLowerCase();
    if (/(launch|start|index|first|account)/.test(normalized)) return 0;
    if (/(home|quit|exit|other)/.test(normalized)) return 1;
    if (/(category|search|browse)/.test(normalized)) return 2;
    if (/(subcategory|new arrivals|popular|recommend)/.test(normalized)) return 3;
    if (/(list|collection|feed)/.test(normalized)) return 6;
    if (/(detail|product|item)/.test(normalized)) return 5;
    if (/(cart|checkout|order|purchase|confirmation)/.test(normalized)) return 7;

    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % sankeyPalette.length;
};

const getPaletteColor = (value: string, alpha = 1): string => {
    const [r, g, b] = sankeyPalette[getStableColorIndex(value)];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getRibbonColor = (link: SankeyLink, alpha: number): string => {
    const sourceColor = sankeyPalette[getStableColorIndex(link.source)];
    const targetColor = sankeyPalette[getStableColorIndex(link.target)];
    const [sr, sg, sb] = sourceColor;
    const [tr, tg, tb] = targetColor;

    return `rgba(${interpolateChannel(sr, tr, 0.34)}, ${interpolateChannel(sg, tg, 0.34)}, ${interpolateChannel(sb, tb, 0.34)}, ${alpha})`;
};

export const SankeyJourney: React.FC<SankeyJourneyProps> = ({
    flows,
    width: propWidth,
    height = 560,
    happyPath,
    selectedTransitionIds = [],
    onFlowToggle,
    appVersions = [],
    selectedAppVersion = null,
    onAppVersionChange,
}) => {
    const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    const happyNodeSet = useMemo(() => new Set(happyPath || []), [happyPath]);

    const selectedTransitionSet = useMemo(() => new Set(selectedTransitionIds), [selectedTransitionIds]);

    const selectedNodeSet = useMemo(() => {
        const nodes = new Set<string>();
        for (const transitionId of selectedTransitionIds) {
            const [from, to] = transitionId.split('→');
            if (from) nodes.add(from);
            if (to) nodes.add(to);
        }
        return nodes;
    }, [selectedTransitionIds]);

    const { nodes, links, nodeLookup, calculatedWidth, calculatedHeight } = useMemo(() => {
        if (flows.length === 0) {
            return {
                nodes: [],
                links: [],
                nodeLookup: new Map<string, SankeyNode>(),
                calculatedWidth: propWidth || 1200,
                calculatedHeight: height,
            };
        }

        const nodeMap = new Map<string, { in: number; out: number }>();
        const connections = new Map<string, Set<string>>();

        flows.forEach((flow) => {
            if (!nodeMap.has(flow.from)) nodeMap.set(flow.from, { in: 0, out: 0 });
            if (!nodeMap.has(flow.to)) nodeMap.set(flow.to, { in: 0, out: 0 });
            nodeMap.get(flow.from)!.out += flow.count;
            nodeMap.get(flow.to)!.in += flow.count;
            if (!connections.has(flow.from)) connections.set(flow.from, new Set());
            connections.get(flow.from)!.add(flow.to);
        });

        const levels = new Map<string, number>();
        const queue: string[] = [];
        const allNodes = Array.from(nodeMap.keys());

        let root = allNodes.find((id) => id.toLowerCase() === 'index')
            || allNodes.find((id) => id.toLowerCase().includes('launch'))
            || allNodes.find((id) => nodeMap.get(id)!.in === 0);

        if (!root && allNodes.length > 0) {
            root = allNodes.reduce((best, id) => nodeMap.get(id)!.out > nodeMap.get(best)!.out ? id : best, allNodes[0]);
        }

        if (root) {
            levels.set(root, 0);
            queue.push(root);
        }

        while (queue.length > 0) {
            const current = queue.shift()!;
            const currentLevel = levels.get(current)!;
            connections.get(current)?.forEach((target) => {
                if (!levels.has(target)) {
                    levels.set(target, currentLevel + 1);
                    queue.push(target);
                }
            });
        }

        nodeMap.forEach((_, id) => {
            if (!levels.has(id)) levels.set(id, 0);
        });

        const maxLevel = Math.max(...Array.from(levels.values()), 0);
        const nodesByLevel: string[][] = Array.from({ length: maxLevel + 1 }, () => []);
        levels.forEach((level, id) => nodesByLevel[level].push(id));

        nodesByLevel.forEach((levelNodes) => {
            levelNodes.sort((a, b) => {
                const aData = nodeMap.get(a)!;
                const bData = nodeMap.get(b)!;
                return Math.max(bData.in, bData.out) - Math.max(aData.in, aData.out);
            });
        });

        const cardHeight = 24;
        const nodePadding = 42;
        const paddingX = 28;
        const paddingY = 36;
        const barMinHeight = 62;
        const barMaxHeight = 300;
        const minLevelSpacing = 318;
        const maxNodeValue = Math.max(...Array.from(nodeMap.values()).map((node) => Math.max(node.in, node.out)), 1);

        const calculatedWidth = propWidth || Math.max(1120, paddingX * 2 + maxLevel * minLevelSpacing + 260);

        const sankeyNodes: SankeyNode[] = [];
        nodesByLevel.forEach((levelNodes, level) => {
            const desiredNodes = levelNodes.map((id) => {
                const nodeData = nodeMap.get(id)!;
                const totalValue = Math.max(nodeData.in, nodeData.out);
                const barHeight = Math.max(
                    barMinHeight,
                    Math.min(barMaxHeight, Math.sqrt(totalValue / maxNodeValue) * barMaxHeight),
                );
                return { id, nodeData, totalValue, barHeight };
            });
            const desiredHeight = desiredNodes.reduce((sum, node) => sum + Math.max(node.barHeight, cardHeight), 0)
                + Math.max(0, desiredNodes.length - 1) * nodePadding;
            const availableHeight = Math.max(260, height - paddingY * 2);
            const scale = desiredHeight > availableHeight ? availableHeight / desiredHeight : 1;
            const effectivePadding = Math.max(12, nodePadding * scale);
            const actualHeight = desiredNodes.reduce((sum, node) => sum + Math.max(node.barHeight * scale, cardHeight), 0)
                + Math.max(0, desiredNodes.length - 1) * effectivePadding;
            let startY = Math.max(24, (height - actualHeight) / 2);

            desiredNodes.forEach(({ id, nodeData, totalValue, barHeight }) => {
                const scaledBarHeight = Math.max(barMinHeight * 0.68, barHeight * scale);
                const slotHeight = Math.max(scaledBarHeight, cardHeight);
                const barY = startY + (slotHeight - scaledBarHeight) / 2;
                const cardY = startY + (slotHeight - cardHeight) / 2;
                sankeyNodes.push({
                    id,
                    name: id.replace(/Activity$/, '').replace(/ViewController$/, '').replace(/Screen$/, ''),
                    level,
                    y: startY,
                    cardY,
                    barY,
                    barHeight: scaledBarHeight,
                    inValue: nodeData.in,
                    outValue: nodeData.out,
                    totalValue,
                });
                startY += slotHeight + effectivePadding;
            });
        });

        const nodeLookup = new Map(sankeyNodes.map((node) => [node.id, node]));
        const maxFlow = Math.max(...flows.map((flow) => flow.count), 1);

        const sankeyLinks = flows
            .map((flow) => {
                const sourceNode = nodeLookup.get(flow.from);
                const targetNode = nodeLookup.get(flow.to);
                if (!sourceNode || !targetNode) return null;

                return {
                    id: `${flow.from}→${flow.to}`,
                    source: flow.from,
                    target: flow.to,
                    value: flow.count,
                    ySource: sourceNode.barY + sourceNode.barHeight / 2,
                    yTarget: targetNode.barY + targetNode.barHeight / 2,
                    thickness: Math.max(4, Math.sqrt(flow.count / maxFlow) * 96),
                    data: flow,
                };
            })
            .filter((link): link is SankeyLink => Boolean(link));

        const getNodeStackLinks = (nodeId: string, direction: 'source' | 'target') => (
            sankeyLinks
                .filter((link) => direction === 'source' ? link.source === nodeId : link.target === nodeId)
                .sort((a, b) => {
                    const aOther = nodeLookup.get(direction === 'source' ? a.target : a.source);
                    const bOther = nodeLookup.get(direction === 'source' ? b.target : b.source);
                    return (aOther?.barY || 0) - (bOther?.barY || 0);
                })
        );

        for (let pass = 0; pass < 3; pass += 1) {
            for (const node of sankeyNodes) {
                for (const direction of ['source', 'target'] as const) {
                    const nodeLinks = getNodeStackLinks(node.id, direction);
                    if (nodeLinks.length === 0) continue;

	                    const linkGap = nodeLinks.length > 6 ? 1.25 : 2;
                    const totalGap = Math.max(0, nodeLinks.length - 1) * linkGap;
                    const availableThickness = Math.max(node.barHeight - totalGap, nodeLinks.length * 2.25);
                    const currentThickness = nodeLinks.reduce((sum, link) => sum + link.thickness, 0);

                    if (currentThickness > availableThickness) {
                        const scale = availableThickness / currentThickness;
                        for (const link of nodeLinks) {
                            link.thickness = Math.max(2.25, link.thickness * scale);
                        }
                    }
                }
            }
        }

        const stackLinks = (nodeId: string, direction: 'source' | 'target') => {
            const node = nodeLookup.get(nodeId);
            if (!node) return;

            const nodeLinks = getNodeStackLinks(nodeId, direction);

            if (nodeLinks.length === 0) return;

	            const linkGap = nodeLinks.length > 6 ? 1.25 : 2;
            const totalThickness = nodeLinks.reduce((sum, link) => sum + link.thickness, 0)
                + Math.max(0, nodeLinks.length - 1) * linkGap;
            let cursor = node.barY + Math.max(0, (node.barHeight - totalThickness) / 2);

            for (const link of nodeLinks) {
                const centerY = cursor + link.thickness / 2;
                if (direction === 'source') {
                    link.ySource = centerY;
                } else {
                    link.yTarget = centerY;
                }
                cursor += link.thickness + linkGap;
            }
        };

        for (const node of sankeyNodes) {
            stackLinks(node.id, 'source');
            stackLinks(node.id, 'target');
        }

        const nodeBottom = sankeyNodes.reduce(
            (bottom, node) => Math.max(bottom, node.barY + node.barHeight, node.cardY + cardHeight),
            height,
        );
        const linkBottom = sankeyLinks.reduce(
            (bottom, link) => Math.max(
                bottom,
                link.ySource + link.thickness / 2,
                link.yTarget + link.thickness / 2,
            ),
            height,
        );
        const contentBottom = Math.max(nodeBottom, linkBottom);
        const calculatedHeight = Math.ceil(contentBottom > height ? contentBottom + 24 : height);

        return { nodes: sankeyNodes, links: sankeyLinks, nodeLookup, calculatedWidth, calculatedHeight };
    }, [flows, propWidth, height]);

    const formatCompact = (value: number): string => {
        if (!Number.isFinite(value)) return '0';
        if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
        if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
        return value.toLocaleString();
    };

    const selectedVersionValue = selectedAppVersion || ALL_APP_VERSIONS_VALUE;
    const versionSelectId = 'journey-version-filter';
    const versionFilter = (
        <div className="relative self-start md:self-auto">
            <label htmlFor={versionSelectId} className="sr-only">Journey app version</label>
            <select
                id={versionSelectId}
                value={selectedVersionValue}
                onChange={(event) => onAppVersionChange?.(event.target.value === ALL_APP_VERSIONS_VALUE ? null : event.target.value)}
                className="h-10 min-w-[190px] appearance-none rounded-md border border-[#dadce0] bg-white px-3 pr-9 text-[11px] font-semibold text-[#202124] shadow-sm outline-none transition-colors hover:border-[#db2777] focus:border-[#db2777] focus:ring-2 focus:ring-[#fbcfe8]"
            >
                <option value={ALL_APP_VERSIONS_VALUE}>All versions</option>
                {appVersions.map((option) => (
                    <option key={option.version} value={option.version}>
                        {option.version === 'UNKNOWN' ? 'Unknown version' : `v${option.version}`} ({formatCompact(option.count)})
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        </div>
    );

    const header = (
        <div className="flex flex-col gap-2 border-b border-[#e8eaed] bg-white px-5 py-4 md:flex-row md:items-start md:justify-between">
            <div>
                <div className="text-[15px] font-medium text-[#202124] underline decoration-dotted decoration-[#bdc1c6] underline-offset-4">
                    Journey lanes
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                    Transition volume by screen path
                </div>
            </div>
            {versionFilter}
        </div>
    );

    if (nodes.length === 0) {
        return (
            <div className="journey-sankey-card rejourney-general-card relative overflow-hidden border border-[#dadce0] bg-white shadow-none">
                <div className="h-1 bg-[#db2777]" />
                {header}
                <div className="journey-sankey-empty flex h-80 w-full items-center justify-center bg-white">
                    <p className="text-sm font-medium text-slate-500">No flow data available for this version.</p>
                </div>
            </div>
        );
    }

    const labelHeight = 24;
    const barWidth = 24;
    const padding = 28;
    const maxLabelWidth = 178;
    const maxLevel = Math.max(...nodes.map((node) => node.level), 1);
    const levelSpacing = maxLevel > 0 ? (calculatedWidth - padding * 2 - barWidth - maxLabelWidth) / maxLevel : 0;
    const maxLinkValue = Math.max(...links.map((link) => link.value), 1);

    const getLinkColor = (link: SankeyLink, isHovered: boolean, isSelected: boolean) => {
        const ratio = link.value / maxLinkValue;
        const baseAlpha = 0.18 + Math.min(0.32, Math.sqrt(ratio) * 0.28);
        if (isSelected) return getRibbonColor(link, isHovered ? 0.76 : 0.62);
        return getRibbonColor(link, isHovered ? 0.58 : baseAlpha);
    };

    const getNodeBarColor = (node: SankeyNode, isHovered: boolean, isSelectedNode: boolean, isHappyNode: boolean): string => {
        if (isSelectedNode) return isHovered ? '#be185d' : '#db2777';
        if (isHappyNode && isHovered) return getPaletteColor(node.id, 0.96);
        return getPaletteColor(node.id, isHovered ? 0.95 : 0.82);
    };

    const hoveredLink = hoveredLinkId ? links.find((link) => link.id === hoveredLinkId) || null : null;
    const activeLink = hoveredLink;

    const hasSelectedPaths = selectedTransitionSet.size > 0;

    return (
        <div className="journey-sankey-card rejourney-general-card relative overflow-hidden border border-[#dadce0] bg-white shadow-none">
            <div className="h-1 bg-[#db2777]" />
            {header}

            <div
                className="relative overflow-x-auto overflow-y-visible bg-white focus:outline-none focus:ring-2 focus:ring-[#fbcfe8] focus:ring-inset"
                style={{
                    minHeight: calculatedHeight,
                    overscrollBehaviorX: 'contain',
                    overscrollBehaviorY: 'auto',
                }}
                tabIndex={0}
                role="region"
                aria-label="Scrollable journey lanes map"
            >
                <div className="relative" style={{ width: calculatedWidth, height: calculatedHeight }}>
                    <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white via-[#f8fafc] to-white" />
                    <svg width={calculatedWidth} height={calculatedHeight} viewBox={`0 0 ${calculatedWidth} ${calculatedHeight}`} className="relative block overflow-visible">
                    <g>
                        {[...links].sort((a, b) => b.thickness - a.thickness).map((link) => {
                            const sourceNode = nodeLookup.get(link.source);
                            const targetNode = nodeLookup.get(link.target);
                            if (!sourceNode || !targetNode) return null;

                            const xStart = padding + sourceNode.level * levelSpacing + barWidth;
                            const xEnd = padding + targetNode.level * levelSpacing;
                            const cp1x = xStart + Math.max(80, (xEnd - xStart) * 0.46);
                            const cp2x = xEnd - Math.max(80, (xEnd - xStart) * 0.46);

                            const isSelected = selectedTransitionSet.has(link.id);
                            const isHovered = hoveredLinkId === link.id;
                            const hasActiveFocus = Boolean(hoveredLinkId || hasSelectedPaths);
                            const isOther = hasActiveFocus && !isHovered && !isSelected;
                            const isAggregate = Boolean(link.data.isAggregate);

                            const t = isSelected ? link.thickness + 8 : isHovered ? link.thickness + 5 : link.thickness;
                            const ht = t / 2;
                            const y0t = link.ySource - ht;
                            const y0b = link.ySource + ht;
                            const y1t = link.yTarget - ht;
                            const y1b = link.yTarget + ht;

                            // Filled ribbon: top bezier forward, bottom bezier backward
                            const d = [
                                `M ${xStart} ${y0t}`,
                                `C ${cp1x} ${y0t}, ${cp2x} ${y1t}, ${xEnd} ${y1t}`,
                                `L ${xEnd} ${y1b}`,
                                `C ${cp2x} ${y1b}, ${cp1x} ${y0b}, ${xStart} ${y0b}`,
                                'Z',
                            ].join(' ');

                            return (
                                <path
                                    key={link.id}
                                    d={d}
                                    fill={getLinkColor(link, isHovered, isSelected)}
                                    stroke={isSelected ? '#be185d' : isHovered ? 'rgba(15, 23, 42, 0.16)' : 'none'}
                                    strokeWidth={isSelected || isHovered ? 1 : 0}
                                    opacity={isOther ? 0.12 : isAggregate ? 0.58 : 1}
                                    onMouseEnter={() => setHoveredLinkId(link.id)}
                                    onMouseLeave={() => setHoveredLinkId(null)}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        if (!isAggregate) {
                                            onFlowToggle?.(link.data);
                                        }
                                    }}
                                    className={isAggregate ? 'cursor-default' : 'cursor-pointer'}
                                    style={{
                                        filter: isHovered || isSelected ? 'drop-shadow(0 4px 8px rgba(15,23,42,0.13))' : 'none',
                                        transition: 'opacity 180ms ease, filter 180ms ease',
                                    }}
                                />
                            );
                        })}
                    </g>

                    <g>
                        {nodes.map((node) => {
                            const x = padding + node.level * levelSpacing;
                            const transitionHover = activeLink && (activeLink.source === node.id || activeLink.target === node.id);
                            const isSelectedNode = selectedNodeSet.has(node.id);
                            const isHovered = hoveredNode === node.id || Boolean(transitionHover) || isSelectedNode;
                            const isOther = (hoveredLinkId || hasSelectedPaths) && !isHovered;
                            const isHappyNode = happyNodeSet.has(node.id);
                            const visibleValue = Math.max(node.inValue, node.outValue);
                            const label = `${node.name}: ${formatCompact(visibleValue)}`;
                            const labelWidth = Math.min(maxLabelWidth, Math.max(92, label.length * 6.8 + 18));
                            const labelX = Math.min(x + 5, calculatedWidth - labelWidth - 8);
                            const labelY = Math.max(4, node.barY + 5);

                            return (
                                <g
                                    key={node.id}
                                    onMouseEnter={() => setHoveredNode(node.id)}
                                    onMouseLeave={() => setHoveredNode(null)}
                                    style={{ cursor: 'pointer' }}
                                >
	                                    <rect
	                                        x={x}
	                                        y={node.barY}
	                                        width={barWidth}
	                                        height={node.barHeight}
	                                        rx="2"
	                                        fill={getNodeBarColor(node, isHovered, isSelectedNode, isHappyNode)}
	                                        stroke={isSelectedNode ? '#be185d' : 'rgba(15, 23, 42, 0.22)'}
	                                        strokeWidth={isHovered || isSelectedNode ? 1.5 : 1}
	                                        opacity={isOther ? 0.34 : 1}
	                                        style={{
	                                            filter: isHovered || isSelectedNode ? 'drop-shadow(0 5px 7px rgba(15,23,42,0.14))' : 'drop-shadow(0 1px 2px rgba(15,23,42,0.08))',
	                                            transition: 'opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease, filter 180ms ease, fill 180ms ease',
	                                        }}
	                                    />
	                                    <rect
	                                        x={labelX}
	                                        y={labelY}
	                                        width={labelWidth}
	                                        height={labelHeight}
	                                        rx="2"
	                                        fill="#ffffff"
	                                        stroke={isSelectedNode ? '#db2777' : isHovered ? '#94a3b8' : '#d4d8de'}
	                                        strokeWidth={isHovered || isSelectedNode ? 1.5 : 1}
	                                        opacity={isOther ? 0.36 : 1}
	                                        pointerEvents="none"
	                                        style={{
	                                            filter: isHovered || isSelectedNode ? 'drop-shadow(0 3px 5px rgba(15,23,42,0.16))' : 'drop-shadow(0 1px 2px rgba(15,23,42,0.12))',
	                                            transition: 'opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease, filter 180ms ease, fill 180ms ease',
	                                        }}
	                                    />
	                                    <foreignObject x={labelX + 6} y={labelY + 4} width={labelWidth - 12} height={16} pointerEvents="none">
	                                        <div className="flex h-full min-w-0 items-center overflow-hidden pointer-events-none">
	                                            <div
	                                                className="min-w-0 truncate text-[10px] font-extrabold leading-none text-slate-800"
	                                                title={label}
	                                            >
	                                                {label}
	                                            </div>
	                                        </div>
	                                    </foreignObject>
                                </g>
                            );
                        })}
                    </g>
                    </svg>
                </div>

            </div>

            <div className="flex flex-wrap items-center gap-4 border-t border-[#dadce0] bg-[#f8fafd] px-5 py-3 text-[11px] font-semibold text-slate-600">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 rounded-full border border-[#dadce0] bg-[#86efac]"></div>
                    <span>Highest volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 rounded-full border border-[#dadce0] bg-[#facc15]"></div>
                    <span>Mid volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 rounded-full border border-[#dadce0] bg-[#fb923c]"></div>
                    <span>Thin path</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-4 rounded-full border border-[#dadce0] bg-[#fb7185]"></div>
                    <span>Lowest volume</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-7 border-t border-dashed border-slate-400"></div>
                    <span>Aggregated tail</span>
                </div>
            </div>
        </div>
    );
};
