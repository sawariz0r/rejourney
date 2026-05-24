import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Check, Copy, Globe, Play, ShieldAlert, X } from 'lucide-react';
import { useSessionData } from '~/shared/providers/SessionContext';
import { DashboardPageHeader } from '~/shared/ui/core/DashboardPageHeader';
import { DashboardLensControls } from '~/shared/ui/core/DashboardLensControls';
import { useSharedRejourneyTimeRange } from '~/shared/hooks/useSharedRejourneyTimeRange';
import { useDemoMode } from '~/shared/providers/DemoModeContext';
import {
    getGeoOverview,
    getSessionsPaginated,
    type ApiLatencyByLocationResponse,
    type GeoIssuesSummary,
} from '~/shared/api/client';
import { useSharedPlatformLens, platformLensToSessionPlatform } from '~/shared/hooks/useSharedPlatformLens';
import { usePathPrefix } from '~/shell/routing/usePathPrefix';
import { DashboardGhostLoader } from '~/shared/ui/core/DashboardGhostLoader';
import { disableMapboxTelemetry, isMapboxConfigured } from '~/shared/integrations/mapbox';
import { getMapboxToken } from '~/shared/config/runtimeEnv';
// @ts-ignore: react-map-gl typing can fail under current tsconfig
import MapGL, { Marker, NavigationControl, Popup } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
const ENABLE_MAPBOX_IN_DEMO = true;
const MAPBOX_TOKEN = getMapboxToken();
const GEO_MAP_STYLE = 'mapbox://styles/mapbox/standard';
const GEO_MAP_CONFIG = {
    basemap: {
        lightPreset: 'day',
        show3dObjects: false,
        showAdminBoundaries: true,
        showPedestrianRoads: false,
        showPointOfInterestLabels: false,
        showTransitLabels: true,
        colorGreenspace: '#8fe39d',
        colorWater: '#58c9f5',
        colorLand: '#c8efbf',
        colorRoads: '#f2a0b6',
        colorMotorways: '#ef8ba4',
        colorTrunks: '#e9a06f',
    },
};

function applyGeoMapConfig(map: any): void {
    if (!map || typeof map.setConfigProperty !== 'function') return;

    Object.entries(GEO_MAP_CONFIG.basemap).forEach(([property, value]) => {
        map.setConfigProperty('basemap', property, value);
    });
}

function getMapInstance(mapRef: React.MutableRefObject<any>) {
    return mapRef.current?.getMap?.() ?? mapRef.current;
}

function getWeightedMapCenter(markers: GeoMarker[]) {
    const validMarkers = markers.filter((marker) => Number.isFinite(marker.lng) && Number.isFinite(marker.lat));
    if (validMarkers.length === 0) {
        return { longitude: -28, latitude: 22 };
    }

    let weightedSin = 0;
    let weightedCos = 0;
    let weightedLat = 0;
    let totalWeight = 0;

    validMarkers.forEach((marker) => {
        const weight = Math.max(marker.sessions, marker.uniqueUsers, 1);
        const radians = (marker.lng * Math.PI) / 180;
        weightedSin += Math.sin(radians) * weight;
        weightedCos += Math.cos(radians) * weight;
        weightedLat += marker.lat * weight;
        totalWeight += weight;
    });

    const longitude = (Math.atan2(weightedSin / totalWeight, weightedCos / totalWeight) * 180) / Math.PI;
    const latitude = Math.max(-38, Math.min(52, weightedLat / totalWeight));
    return { longitude, latitude };
}

type LatencyTier = 'excellent' | 'good' | 'degraded' | 'critical' | 'unknown';

interface MarkerStyle {
    fill: string;
    solid: string;
    ring: string;
    face: 'happy' | 'neutral' | 'angry';
}

interface GeoMarker {
    id: string;
    city: string;
    country: string;
    lat: number;
    lng: number;
    sessions: number;
    uniqueUsers: number;
    avgLatencyMs?: number;
    latencyTier: LatencyTier;
    markerSize: number;
    style: MarkerStyle;
}

const EMPTY_ISSUES: GeoIssuesSummary = {
    locations: [],
    countries: [],
    summary: {
        totalIssues: 0,
        byType: {
            crashes: 0,
            anrs: 0,
            errors: 0,
            rageTaps: 0,
            apiErrors: 0,
        },
    },
};

const EMPTY_LATENCY: ApiLatencyByLocationResponse = {
    regions: [],
    summary: {
        avgLatency: 0,
        totalRequests: 0,
    },
};

const LATENCY_STYLE: Record<LatencyTier, MarkerStyle> = {
    excellent: {
        fill: 'rgba(34, 197, 94, 0.9)',
        solid: 'rgba(21, 128, 61, 1)',
        ring: 'rgba(34, 197, 94, 0.46)',
        face: 'happy',
    },
    good: {
        fill: 'rgba(93, 173, 236, 0.92)',
        solid: 'rgba(37, 99, 235, 1)',
        ring: 'rgba(93, 173, 236, 0.5)',
        face: 'neutral',
    },
    degraded: {
        fill: 'rgba(249, 168, 212, 0.92)',
        solid: 'rgba(190, 24, 93, 1)',
        ring: 'rgba(249, 168, 212, 0.52)',
        face: 'neutral',
    },
    critical: {
        fill: 'rgba(255, 71, 87, 0.94)',
        solid: 'rgba(185, 28, 28, 1)',
        ring: 'rgba(255, 71, 87, 0.54)',
        face: 'angry',
    },
    unknown: {
        fill: 'rgba(107, 114, 128, 0.86)',
        solid: 'rgba(55, 65, 81, 1)',
        ring: 'rgba(100, 116, 139, 0.46)',
        face: 'neutral',
    },
};

function normalizeCountry(value?: string): string {
    return (value || '').trim().toLowerCase();
}

function normalizeCity(value?: string): string {
    return (value || '').trim().toLowerCase();
}

function getLocationLatencyKey(country?: string, city?: string): string {
    return `${normalizeCountry(country)}:${normalizeCity(city)}`;
}

function getLatencyTier(latency?: number): LatencyTier {
    if (latency === undefined || Number.isNaN(latency) || latency <= 0) {
        return 'unknown';
    }
    if (latency < 600) return 'excellent';
    if (latency < 900) return 'good';
    if (latency < 1200) return 'degraded';
    return 'critical';
}

function getMarkerSize(activeUsers: number, maxActiveUsers: number): number {
    const safeMax = Math.max(maxActiveUsers, 1);
    const normalized = Math.sqrt(Math.max(0, activeUsers) / safeMax);
    return Math.round(12 + normalized * 26);
}

function formatLatency(value?: number): string {
    if (!value || Number.isNaN(value)) return 'N/A';
    return `${Math.round(value)}ms`;
}

function getZoomMarkerSize(baseSize: number, zoom: number): number {
    const zoomScale = 1 + Math.max(0, zoom - 1.25) * 0.34;
    return Math.round(Math.max(18, Math.min(56, baseSize * zoomScale)));
}

function renderLatencyFace(face: MarkerStyle['face']) {
    const mouthStyle: React.CSSProperties =
        face === 'happy'
            ? {
                left: '29%',
                top: '47%',
                width: '42%',
                height: '26%',
                borderBottom: '2px solid rgba(3, 7, 18, 0.86)',
                borderRadius: '0 0 999px 999px',
            }
            : face === 'angry'
                ? {
                    left: '32%',
                    top: '62%',
                    width: '36%',
                    height: '18%',
                    borderTop: '2px solid rgba(3, 7, 18, 0.86)',
                    borderRadius: '999px 999px 0 0',
                }
                : {
                    left: '32%',
                    top: '59%',
                    width: '36%',
                    height: '2px',
                    backgroundColor: 'rgba(3, 7, 18, 0.82)',
                    borderRadius: '999px',
                };

    return (
        <span className="pointer-events-none absolute inset-0 block">
            <span
                className="absolute rounded-full bg-slate-950"
                style={{ left: '29%', top: '33%', width: '10%', height: '10%' }}
            />
            <span
                className="absolute rounded-full bg-slate-950"
                style={{ right: '29%', top: '33%', width: '10%', height: '10%' }}
            />
            {face === 'angry' && (
                <>
                    <span
                        className="absolute bg-slate-950"
                        style={{ left: '24%', top: '25%', width: '19%', height: '2px', transform: 'rotate(24deg)' }}
                    />
                    <span
                        className="absolute bg-slate-950"
                        style={{ right: '24%', top: '25%', width: '19%', height: '2px', transform: 'rotate(-24deg)' }}
                    />
                </>
            )}
            <span className="absolute block" style={mouthStyle} />
        </span>
    );
}

type GeoSessionRow = {
    id: string;
    durationSeconds?: number;
    isFirstSession?: boolean;
    visitorSessionNumber?: number | null;
    canOpenReplay?: boolean;
    hasSuccessfulRecording?: boolean;
    crashCount?: number;
    anrCount?: number;
    errorCount?: number;
    rageTapCount?: number;
    deadTapCount?: number;
    apiErrorCount?: number;
    apiAvgResponseMs?: number;
    appStartupTimeMs?: number;
};

function getShortSessionId(id: string): string {
    const compact = id.replace(/-/g, '').trim();
    return (compact || id).slice(0, 4);
}

function formatSessionDuration(seconds?: number): string {
    const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function getVisitorLabel(session: GeoSessionRow): string {
    const sessionNumber = session.visitorSessionNumber ?? null;
    if (sessionNumber && sessionNumber > 1) return `Return ${sessionNumber}`;
    return 'New';
}

function getGeoSessionFace(session: GeoSessionRow): MarkerStyle['face'] {
    const severeIssues = (session.crashCount || 0) + (session.anrCount || 0) + (session.rageTapCount || 0);
    if (severeIssues > 0) return 'angry';
    const hasFriction =
        (session.errorCount || 0) > 0 ||
        (session.deadTapCount || 0) > 0 ||
        (session.apiErrorCount || 0) > 0 ||
        (session.apiAvgResponseMs || 0) > 1000 ||
        (session.appStartupTimeMs || 0) > 3000;
    return hasFriction ? 'neutral' : 'happy';
}

function MiniGeoFace({ face }: { face: MarkerStyle['face'] }) {
    const style =
        face === 'happy'
            ? LATENCY_STYLE.excellent
            : face === 'angry'
                ? LATENCY_STYLE.critical
                : LATENCY_STYLE.good;

    return (
        <span
            className="relative inline-flex h-6 w-6 shrink-0 rounded-full border border-slate-950/60"
            style={{
                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.86) 0, ${style.fill} 36%, ${style.solid} 100%)`,
                boxShadow: `0 0 0 2px rgba(255,255,255,0.74), 0 0 0 3px ${style.ring}`,
            }}
            aria-hidden="true"
        >
            {renderLatencyFace(face)}
        </span>
    );
}

async function copyTextToClipboard(value: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
    }
    if (typeof document === 'undefined') return false;

    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
        return document.execCommand('copy');
    } finally {
        document.body.removeChild(textarea);
    }
}

export const Geo: React.FC = () => {
    const { selectedProject } = useSessionData();
    const { isDemoMode } = useDemoMode();
    const navigate = useNavigate();
    const pathPrefix = usePathPrefix();
    const { platformLens } = useSharedPlatformLens(selectedProject?.id, selectedProject?.platforms);
    const platform = platformLensToSessionPlatform(platformLens);
    const mapRef = React.useRef<any>(null);
    const isHoverPausedRef = React.useRef(false);
    const isInteractionPausedRef = React.useRef(false);
    const resumeRotationTimerRef = React.useRef<number | null>(null);

    const { timeRange, setTimeRange } = useSharedRejourneyTimeRange(selectedProject?.id);
    const [issues, setIssues] = useState<GeoIssuesSummary>(EMPTY_ISSUES);
    const [latencyByLocation, setLatencyByLocation] = useState<ApiLatencyByLocationResponse>(EMPTY_LATENCY);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
    const [markerSessions, setMarkerSessions] = useState<GeoSessionRow[]>([]);
    const [markerSessionsState, setMarkerSessionsState] = useState<'idle' | 'loading' | 'error'>('idle');
    const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
    const [mapZoom, setMapZoom] = useState(1.34);

    useEffect(() => {
        disableMapboxTelemetry();
    }, []);

    useEffect(() => {
        if (!selectedProject?.id) {
            setIssues(EMPTY_ISSUES);
            setLatencyByLocation(EMPTY_LATENCY);
            setLoadError(null);
            setIsLoading(false);
            return;
        }

        let isCancelled = false;
        setIsLoading(true);
        setLoadError(null);

        void getGeoOverview(selectedProject.id, timeRange, platform)
            .then((overview) => {
                if (isCancelled) return;
                setIssues(overview.issues);
                setLatencyByLocation(overview.latencyByLocation);
                setLoadError(overview.failedSections.length > 0 ? 'Some geographic sections are unavailable.' : null);
            })
            .catch((err) => {
                console.error('Failed to load geographic overview:', err);
                if (isCancelled) return;
                setIssues(EMPTY_ISSUES);
                setLatencyByLocation(EMPTY_LATENCY);
                setLoadError('Could not load map data.');
            })
            .finally(() => {
                if (!isCancelled) setIsLoading(false);
            });

        return () => {
            isCancelled = true;
        };
    }, [selectedProject?.id, timeRange, platform]);

    const latencyByCountry = useMemo(() => {
        const countryToLatency = new Map<string, number>();
        for (const region of latencyByLocation.regions) {
            countryToLatency.set(normalizeCountry(region.country), region.avgLatencyMs);
        }
        return countryToLatency;
    }, [latencyByLocation.regions]);

    const latencyByLocationKey = useMemo(() => {
        const locationToLatency = new Map<string, number>();
        for (const location of latencyByLocation.locations || []) {
            locationToLatency.set(getLocationLatencyKey(location.country, location.city), location.avgLatencyMs);
        }
        return locationToLatency;
    }, [latencyByLocation.locations]);

    const markers = useMemo<GeoMarker[]>(() => {
        const locations = issues.locations || [];
        const maxActiveUsers = Math.max(...locations.map((loc) => loc.uniqueUsers || 0), 1);
        const fallbackLatency = latencyByLocation.summary.avgLatency > 0
            ? latencyByLocation.summary.avgLatency
            : undefined;

        return locations
            .filter((loc) => Number.isFinite(loc.lat) && Number.isFinite(loc.lng))
            .map((loc, index) => {
                const avgLatencyMs =
                    latencyByLocationKey.get(getLocationLatencyKey(loc.country, loc.city))
                    ?? latencyByCountry.get(normalizeCountry(loc.country))
                    ?? fallbackLatency;
                const latencyTier = getLatencyTier(avgLatencyMs);

                return {
                    id: `${loc.country}:${loc.city}:${index}`,
                    city: loc.city || 'Unknown',
                    country: loc.country,
                    lat: loc.lat,
                    lng: loc.lng,
                    sessions: loc.sessions || 0,
                    uniqueUsers: loc.uniqueUsers || 0,
                    avgLatencyMs,
                    latencyTier,
                    markerSize: getMarkerSize(loc.uniqueUsers || 0, maxActiveUsers),
                    style: LATENCY_STYLE[latencyTier],
                };
            })
            .sort((a, b) => b.uniqueUsers - a.uniqueUsers);
    }, [issues.locations, latencyByCountry, latencyByLocation.summary.avgLatency, latencyByLocationKey]);

    const hoveredMarker = useMemo(
        () => (hoveredMarkerId ? markers.find((marker) => marker.id === hoveredMarkerId) || null : null),
        [hoveredMarkerId, markers],
    );

    const selectedMarker = useMemo(
        () => (selectedMarkerId ? markers.find((marker) => marker.id === selectedMarkerId) || null : null),
        [selectedMarkerId, markers],
    );

    const initialViewState = useMemo(() => {
        const center = getWeightedMapCenter(markers);
        return {
            longitude: center.longitude,
            latitude: center.latitude,
            zoom: 1.34,
            pitch: 14,
            bearing: 0,
        };
    }, [markers]);

    useEffect(() => {
        let animationFrame = 0;
        let previousTime = performance.now();

        const rotateGlobe = (time: number) => {
            const map = getMapInstance(mapRef);
            if (!map || isHoverPausedRef.current || isInteractionPausedRef.current) return;

            const center = map.getCenter();
            const deltaSeconds = Math.min((time - previousTime) / 1000, 0.05);
            previousTime = time;
            map.setCenter([center.lng + deltaSeconds * 1.8, center.lat]);
        };

        const tick = (time: number) => {
            rotateGlobe(time);
            animationFrame = window.requestAnimationFrame(tick);
        };

        animationFrame = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(animationFrame);
            if (resumeRotationTimerRef.current) {
                window.clearTimeout(resumeRotationTimerRef.current);
            }
        };
    }, []);

    const pauseRotationBriefly = () => {
        isInteractionPausedRef.current = true;
        if (resumeRotationTimerRef.current) {
            window.clearTimeout(resumeRotationTimerRef.current);
        }
        resumeRotationTimerRef.current = window.setTimeout(() => {
            isInteractionPausedRef.current = false;
            resumeRotationTimerRef.current = null;
        }, 2400);
    };

    const setHoverPaused = (isPaused: boolean) => {
        isHoverPausedRef.current = isPaused;
    };

    useEffect(() => {
        if (selectedMarkerId && !selectedMarker) {
            setSelectedMarkerId(null);
        }
    }, [selectedMarker, selectedMarkerId]);

    useEffect(() => {
        if (!selectedProject?.id || !selectedMarker) {
            setMarkerSessions([]);
            setMarkerSessionsState('idle');
            return;
        }

        let isCancelled = false;
        setMarkerSessions([]);
        setMarkerSessionsState('loading');

        void getSessionsPaginated({
            projectId: selectedProject.id,
            timeRange,
            platform,
            hasRecording: true,
            includeTotal: false,
            limit: 8,
            sort: 'date',
            sortDir: 'desc',
            geoCountry: selectedMarker.country,
            geoCity: selectedMarker.city === 'Unknown' ? undefined : selectedMarker.city,
        })
            .then((result) => {
                if (isCancelled) return;
                setMarkerSessions((result.sessions || []).filter((session) => session.canOpenReplay ?? session.hasSuccessfulRecording ?? true));
                setMarkerSessionsState('idle');
            })
            .catch((err) => {
                console.error('Failed to load geo marker sessions:', err);
                if (isCancelled) return;
                setMarkerSessions([]);
                setMarkerSessionsState('error');
            });

        return () => {
            isCancelled = true;
        };
    }, [platform, selectedMarker, selectedProject?.id, timeRange]);

    const copySessionId = (event: React.MouseEvent, sessionId: string) => {
        event.stopPropagation();
        void copyTextToClipboard(sessionId).then((didCopy) => {
            if (!didCopy) return;
            setCopiedSessionId(sessionId);
            window.setTimeout(() => {
                setCopiedSessionId((current) => (current === sessionId ? null : current));
            }, 1200);
        });
    };

    if (isLoading && selectedProject?.id) {
        return <DashboardGhostLoader variant="map" />;
    }

    return (
        <div className="flex min-h-screen flex-col bg-transparent font-sans text-slate-900">
            <div className="shrink-0">
                <DashboardPageHeader
                    title="Geographic Analysis"
                    icon={<Globe className="w-6 h-6" />}
                    iconColor="bg-[#dbeafe]"
                >
                    <DashboardLensControls timeRange={timeRange} onTimeRangeChange={setTimeRange} />
                </DashboardPageHeader>
            </div>

            <div className="relative min-h-0 w-full flex-1 bg-white">
                {!selectedProject?.id ? (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">Select a project.</div>
                ) : !isMapboxConfigured() ? (
                    <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-rose-500 px-4">
                        <ShieldAlert className="h-5 w-5 mr-2" />
                        <span>404 - New World Not Discovered Yet</span>
                    </div>
                ) : (isDemoMode && !ENABLE_MAPBOX_IN_DEMO) ? (
                    <div className="absolute inset-0 flex items-center justify-center text-center p-8">
                        <div className="max-w-md">
                            <Globe className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 mb-2 font-sans">Mapbox Disabled in Demo</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Geographic maps are disabled during the live demo to focus on privacy and conserve resources.
                                Full interactive maps are available on the production dashboard.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div
                        className="relative h-[calc(100vh-132px)] min-h-[560px] w-full overflow-hidden bg-[#05070d]"
                        onMouseEnter={() => setHoverPaused(true)}
                        onMouseLeave={() => setHoverPaused(false)}
                        onFocus={() => setHoverPaused(true)}
                        onBlur={() => setHoverPaused(false)}
                    >
                        <MapGL
                            ref={mapRef}
                            mapboxAccessToken={MAPBOX_TOKEN}
                            reuseMaps
                            initialViewState={initialViewState}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                            mapStyle={GEO_MAP_STYLE}
                            projection={{ name: 'globe' }}
                            dragPan
                            dragRotate
                            scrollZoom
                            touchZoomRotate
                            doubleClickZoom
                            keyboard
                            cursor="grab"
                            onDragStart={pauseRotationBriefly}
                            onZoomStart={pauseRotationBriefly}
                            onRotateStart={pauseRotationBriefly}
                            onZoom={(event: any) => setMapZoom(event.viewState.zoom)}
                            onLoad={(event: any) => {
                                mapRef.current = event.target;
                                applyGeoMapConfig(event.target);
                            }}
                        >
                            <NavigationControl position="bottom-right" showCompass showZoom />

                            {markers.map((marker) => {
                                const isHovered = marker.id === hoveredMarkerId;
                                const isSelected = marker.id === selectedMarkerId;
                                const markerSize = getZoomMarkerSize(marker.markerSize, mapZoom);
                                return (
                                    <Marker
                                        key={marker.id}
                                        longitude={marker.lng}
                                        latitude={marker.lat}
                                        anchor="center"
                                        style={{ pointerEvents: 'none' }}
                                        onClick={(event: any) => {
                                            event.originalEvent?.stopPropagation?.();
                                            setSelectedMarkerId(marker.id);
                                            setHoverPaused(true);
                                            pauseRotationBriefly();
                                        }}
                                    >
                                        <button
                                            type="button"
                                            className="relative rounded-full transition-transform duration-150"
                                            style={{
                                                width: `${markerSize}px`,
                                                height: `${markerSize}px`,
                                                pointerEvents: 'auto',
                                                transform: isHovered || isSelected ? 'scale(1.18)' : 'scale(1)',
                                                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.82) 0, ${marker.style.fill} 27%, ${marker.style.solid} 100%)`,
                                                border: '1.5px solid rgba(8, 13, 23, 0.62)',
                                                opacity: isHovered || isSelected ? 1 : 0.9,
                                                boxShadow: isHovered || isSelected
                                                    ? `0 0 0 3px rgba(255,255,255,0.86), 0 0 0 6px ${marker.style.ring}, 0 0 20px ${marker.style.ring}, 0 5px 14px rgba(2,6,23,0.32)`
                                                    : `0 0 0 2px rgba(255,255,255,0.78), 0 0 0 4px ${marker.style.ring}, 0 3px 10px rgba(2,6,23,0.22)`,
                                            }}
                                            aria-label={`${marker.city}, ${marker.country}: ${marker.uniqueUsers.toLocaleString()} unique users, ${marker.sessions.toLocaleString()} sessions, ${formatLatency(marker.avgLatencyMs)} avg latency`}
                                            aria-pressed={isSelected}
                                            onPointerDown={(event) => event.stopPropagation()}
                                            onPointerUp={(event) => {
                                                event.stopPropagation();
                                                setSelectedMarkerId(marker.id);
                                                setHoverPaused(true);
                                                pauseRotationBriefly();
                                            }}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setSelectedMarkerId(marker.id);
                                                setHoverPaused(true);
                                                pauseRotationBriefly();
                                            }}
                                            onMouseEnter={() => setHoveredMarkerId(marker.id)}
                                            onMouseLeave={() => setHoveredMarkerId((prev) => (prev === marker.id ? null : prev))}
                                        >
                                            {renderLatencyFace(marker.style.face)}
                                        </button>
                                    </Marker>
                                );
                            })}

                            {hoveredMarker && (
                                <Popup
                                    longitude={hoveredMarker.lng}
                                    latitude={hoveredMarker.lat}
                                    closeButton={false}
                                    closeOnClick={false}
                                    anchor="bottom"
                                    offset={14}
                                    className="geo-hover-popup"
                                >
                                    <div className="dashboard-surface px-3 py-2 text-[11px] text-slate-700">
                                        <div className="mb-0.5 font-semibold text-slate-900">
                                            {hoveredMarker.city}, {hoveredMarker.country}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-600">
                                            <span>{hoveredMarker.uniqueUsers.toLocaleString()} users</span>
                                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                                            <span>{hoveredMarker.sessions.toLocaleString()} sessions</span>
                                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                                            <span style={{ color: hoveredMarker.style.solid }}>{formatLatency(hoveredMarker.avgLatencyMs)}</span>
                                        </div>
                                    </div>
                                </Popup>
                            )}
                        </MapGL>
                        {loadError && (
                            <div className="absolute left-4 top-4 z-20 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-900 shadow-sm">
                                {loadError}
                            </div>
                        )}
                        {selectedMarker && (
                            <div className="absolute right-4 top-4 z-30 w-[min(360px,calc(100%-2rem))] overflow-hidden border-2 border-black bg-white text-slate-900 shadow-neo">
                                <div className="flex items-start justify-between gap-3 border-b-2 border-black bg-[#cffafe] px-3 py-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-black uppercase tracking-wide text-black">
                                            {selectedMarker.city}, {selectedMarker.country}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black bg-white text-black shadow-neo-sm transition-all hover:-translate-y-0.5 hover:bg-[#ecfeff] hover:shadow-neo"
                                        onClick={() => setSelectedMarkerId(null)}
                                        aria-label="Close replay sessions"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-[26px_minmax(0,1fr)_68px_86px] items-center gap-2 border-b border-black/15 bg-slate-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-slate-500">
                                    <span />
                                    <span>UUID</span>
                                    <span className="text-right">Duration</span>
                                    <span className="text-right">Return</span>
                                </div>

                                <div className="max-h-[244px] overflow-y-auto">
                                    {markerSessionsState === 'loading' && (
                                        <div className="px-3 py-5 text-center text-xs font-semibold text-slate-500">
                                            Loading replay rows...
                                        </div>
                                    )}
                                    {markerSessionsState === 'error' && (
                                        <div className="px-3 py-5 text-center text-xs font-semibold text-rose-700">
                                            Could not load replay sessions.
                                        </div>
                                    )}
                                    {markerSessionsState === 'idle' && markerSessions.length === 0 && (
                                        <div className="px-3 py-5 text-center text-xs font-semibold text-slate-500">
                                            No replay-ready sessions for this location.
                                        </div>
                                    )}
                                    {markerSessionsState === 'idle' && markerSessions.map((session) => {
                                        const face = getGeoSessionFace(session);
                                        const canOpenReplay = session.canOpenReplay ?? session.hasSuccessfulRecording ?? true;
                                        const visitorLabel = getVisitorLabel(session);
                                        return (
                                            <div
                                                key={session.id}
                                                className={`grid grid-cols-[26px_minmax(0,1fr)_68px_86px] items-center gap-2 border-b border-black/10 px-3 py-2 text-left transition-colors last:border-b-0 ${canOpenReplay ? 'cursor-pointer hover:bg-[#ecfeff]' : 'cursor-not-allowed opacity-50'}`}
                                                onClick={() => {
                                                    if (canOpenReplay) navigate(`${pathPrefix}/sessions/${session.id}`);
                                                }}
                                                title={canOpenReplay ? `Open replay ${session.id}` : 'Replay unavailable'}
                                            >
                                                <MiniGeoFace face={face} />
                                                <button
                                                    type="button"
                                                    className="inline-flex min-w-0 items-center gap-1 justify-self-start font-mono text-xs font-black text-slate-900 transition-colors hover:text-[#2563eb]"
                                                    onClick={(event) => copySessionId(event, session.id)}
                                                    title={`Copy ${session.id}`}
                                                >
                                                    <span className="truncate">{getShortSessionId(session.id)}</span>
                                                    {copiedSessionId === session.id ? (
                                                        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 shrink-0 text-slate-400" />
                                                    )}
                                                </button>
                                                <span className="justify-self-end border border-black bg-[#ecfeff] px-1.5 py-0.5 font-mono text-[11px] font-black text-black">
                                                    {formatSessionDuration(session.durationSeconds)}
                                                </span>
                                                <span className={`justify-self-end border px-1.5 py-0.5 text-[10px] font-black uppercase ${visitorLabel === 'New' ? 'border-emerald-700 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-slate-50 text-slate-700'}`}>
                                                    {visitorLabel}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center justify-between border-t border-black/15 bg-white px-3 py-2 text-[10px] font-semibold text-slate-500">
                                    <span>{markerSessions.length} watchable</span>
                                    <span className="inline-flex items-center gap-1 text-slate-700">
                                        <Play className="h-3 w-3" />
                                        Click a row to watch
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Geo;
