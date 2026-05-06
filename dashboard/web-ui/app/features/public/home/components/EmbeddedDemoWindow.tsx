/**
 * Embedded Demo Window
 *
 * A neo-brutalist workbench frame that embeds the full demo experience
 * directly on the landing page.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Maximize2, MousePointerClick } from 'lucide-react';

const DEMO_CURSOR_FOLLOW_PAD_PX = 16;

export const EmbeddedDemoWindow: React.FC = () => {
    const sectionRef = useRef<HTMLElement>(null);
    const demoFrameRef = useRef<HTMLIFrameElement>(null);
    const [shouldLoadDemo, setShouldLoadDemo] = useState(false);
    const [followingPointer, setFollowingPointer] = useState(false);
    const [followPos, setFollowPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const section = sectionRef.current;
        if (!section || shouldLoadDemo) return;

        let hasScrolled = window.scrollY > 80;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (hasScrolled && entry.isIntersecting) {
                    setShouldLoadDemo(true);
                    observer.disconnect();
                    window.removeEventListener('scroll', handleScroll);
                }
            },
            { threshold: 0.08 }
        );

        const handleScroll = () => {
            hasScrolled = true;
            const rect = section.getBoundingClientRect();
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                setShouldLoadDemo(true);
                observer.disconnect();
                window.removeEventListener('scroll', handleScroll);
            }
        };

        observer.observe(section);
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', handleScroll);
        };
    }, [shouldLoadDemo]);

    const updateFollowCoords = useCallback((clientX: number, clientY: number) => {
        const section = sectionRef.current;
        if (!section) return;
        const r = section.getBoundingClientRect();
        const xmin = DEMO_CURSOR_FOLLOW_PAD_PX;
        const ymin = DEMO_CURSOR_FOLLOW_PAD_PX;
        const xmax = Math.max(xmin + 8, r.width - DEMO_CURSOR_FOLLOW_PAD_PX);
        const ymax = Math.max(ymin + 8, r.height - DEMO_CURSOR_FOLLOW_PAD_PX);
        setFollowPos({
            x: Math.min(xmax, Math.max(xmin, clientX - r.left)),
            y: Math.min(ymax, Math.max(ymin, clientY - r.top)),
        });
    }, []);

    const onSectionPointerEnter = useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            if (e.pointerType !== 'mouse') return;
            setFollowingPointer(true);
            updateFollowCoords(e.clientX, e.clientY);
        },
        [updateFollowCoords],
    );

    const onSectionPointerMove = useCallback(
        (e: React.PointerEvent<HTMLElement>) => {
            if (e.pointerType !== 'mouse') return;
            updateFollowCoords(e.clientX, e.clientY);
        },
        [updateFollowCoords],
    );

    const onSectionPointerLeave = useCallback(() => {
        setFollowingPointer(false);
    }, []);

    useEffect(() => {
        if (!shouldLoadDemo) return;

        const frame = demoFrameRef.current;
        if (!frame) return;

        let cleanupFrameDocument = () => {};

        const attachFrameDocumentListeners = () => {
            cleanupFrameDocument();

            let doc: Document | null = null;
            try {
                doc = frame.contentDocument;
            } catch {
                doc = null;
            }
            if (!doc) return;

            const hideCursorStyle = doc.createElement('style');
            hideCursorStyle.textContent = 'html, body, body * { cursor: none !important; }';
            doc.head?.appendChild(hideCursorStyle);

            const handleFrameMove = (event: MouseEvent) => {
                const frameRect = frame.getBoundingClientRect();
                setFollowingPointer(true);
                updateFollowCoords(frameRect.left + event.clientX, frameRect.top + event.clientY);
            };

            const handleFrameLeave = (event: MouseEvent) => {
                const section = sectionRef.current;
                if (!section) {
                    setFollowingPointer(false);
                    return;
                }

                const frameRect = frame.getBoundingClientRect();
                const sectionRect = section.getBoundingClientRect();
                const clientX = frameRect.left + event.clientX;
                const clientY = frameRect.top + event.clientY;
                const stillInsideSection =
                    clientX >= sectionRect.left &&
                    clientX <= sectionRect.right &&
                    clientY >= sectionRect.top &&
                    clientY <= sectionRect.bottom;

                if (!stillInsideSection) {
                    setFollowingPointer(false);
                }
            };

            doc.addEventListener('mousemove', handleFrameMove);
            doc.addEventListener('mouseleave', handleFrameLeave);

            cleanupFrameDocument = () => {
                doc?.removeEventListener('mousemove', handleFrameMove);
                doc?.removeEventListener('mouseleave', handleFrameLeave);
                hideCursorStyle.remove();
            };
        };

        attachFrameDocumentListeners();
        frame.addEventListener('load', attachFrameDocumentListeners);

        return () => {
            frame.removeEventListener('load', attachFrameDocumentListeners);
            cleanupFrameDocument();
        };
    }, [shouldLoadDemo, updateFollowCoords]);

    return (
        <section
            ref={sectionRef}
            aria-label="Interactive Demo"
            className={`relative w-full border-t-2 border-black bg-[#f8fafc] px-3 pb-14 pt-16 sm:px-4 sm:pb-20 sm:pt-24 lg:px-6 lg:pt-28 ${followingPointer ? 'cursor-none' : ''}`}
            onPointerEnter={onSectionPointerEnter}
            onPointerMove={onSectionPointerMove}
            onPointerLeave={onSectionPointerLeave}
        >
            {/* Embed must be >1280px wide (after borders) or Tailwind `xl:` breakpoints won't apply inside the iframe. */}
            <div className="mx-auto mb-7 max-w-7xl sm:mb-10">
                <div role="presentation" className="relative w-full px-3 py-10 sm:py-14 lg:py-16">
                    <div className="relative z-[1] mx-auto inline-block max-w-2xl px-2 pb-2 pt-1 sm:px-3">
                        <h2 className="relative pl-11 text-3xl font-black uppercase leading-[0.92] tracking-tight text-black sm:pl-14 sm:text-5xl lg:pl-16 lg:text-6xl">
                            Walk the product.
                        </h2>
                    </div>
                    {!followingPointer && (
                        <div className="pointer-events-none absolute inset-0 isolate z-[2] overflow-visible" aria-hidden>
                            <MousePointerClick
                                className="walk-product-heading-cursor h-8 w-8 sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                                strokeWidth={2.5}
                                aria-hidden
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-[min(100%,1720px)]">
                <div className="relative">
                    <div className="absolute -inset-2 hidden rotate-[-0.35deg] border-2 border-black bg-[#5dadec] lg:block" />
                    <div className="absolute -inset-2 hidden translate-x-2 translate-y-2 border-2 border-black bg-[#fef08a] lg:block" />

                    <div className="relative z-10 overflow-hidden border-2 border-black bg-white shadow-[7px_7px_0px_0px_rgba(0,0,0,1)] sm:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black bg-white px-3 py-3 sm:gap-3 sm:px-4">
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                <div className="flex shrink-0 gap-1.5 sm:gap-2">
                                    <div className="h-3 w-3 border-2 border-black bg-[#ef4444]" />
                                    <div className="h-3 w-3 border-2 border-black bg-[#fef08a]" />
                                    <div className="h-3 w-3 border-2 border-black bg-[#86efac]" />
                                </div>
                                <div className="min-w-0 border-2 border-black bg-[#f8fafc] px-3 py-1">
                                    <span className="truncate font-mono text-[10px] font-black uppercase tracking-widest text-black sm:text-xs">
                                        Live dashboard demo
                                    </span>
                                </div>
                            </div>

                            <div className="flex w-full items-center justify-end gap-2 min-[460px]:w-auto">
                                <Link
                                    to="/demo"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex w-full items-center justify-center gap-2 border-2 border-black bg-[#fef08a] px-3 py-2 font-mono text-[10px] font-black uppercase tracking-widest text-black shadow-neo-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-neo min-[460px]:w-auto"
                                    title="Open in new tab"
                                >
                                    <Maximize2 size={14} strokeWidth={3} />
                                    Fullscreen
                                </Link>
                            </div>
                        </div>

                        <div className="relative bg-white">
                            {shouldLoadDemo ? (
                                <iframe
                                    ref={demoFrameRef}
                                    src="/demo"
                                    className="h-[min(68vh,560px)] min-h-[420px] w-full cursor-none border-0 bg-white sm:h-[700px] lg:h-[min(82vh,920px)] lg:min-h-[760px]"
                                    title="Rejourney Dashboard Demo"
                                    loading="eager"
                                    tabIndex={-1}
                                />
                            ) : (
                                <div className="flex h-[min(68vh,560px)] min-h-[420px] items-center justify-center bg-white sm:h-[700px] lg:h-[min(82vh,920px)] lg:min-h-[760px]">
                                    <div className="relative h-32 w-32 border-2 border-black bg-white shadow-neo sm:h-40 sm:w-40">
                                        <div className="absolute -left-6 top-6 h-12 w-12 rotate-[-8deg] border-2 border-black bg-[#5dadec] shadow-neo-sm sm:-left-8 sm:top-7 sm:h-14 sm:w-14" />
                                        <div className="absolute -right-6 top-10 h-10 w-10 rotate-[7deg] border-2 border-black bg-[#fef08a] shadow-neo-sm sm:-right-8 sm:top-12 sm:h-12 sm:w-12" />
                                        <div className="absolute bottom-5 left-1/2 flex h-20 w-20 -translate-x-1/2 items-center justify-center border-2 border-black bg-white shadow-neo-sm sm:bottom-6 sm:h-24 sm:w-24">
                                            <img
                                                src="/rejourneyIcon-removebg-preview.png"
                                                alt=""
                                                role="presentation"
                                                className="h-12 w-12 object-contain sm:h-14 sm:w-14"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {followingPointer && (
                <div className="pointer-events-none absolute inset-0 isolate z-30 overflow-hidden" aria-hidden>
                    <MousePointerClick
                        className="walk-product-heading-cursor h-8 w-8 sm:h-11 sm:w-11 lg:h-12 lg:w-12"
                        strokeWidth={2.5}
                        aria-hidden
                        style={{
                            animation: 'none',
                            left: `${followPos.x}px`,
                            top: `${followPos.y}px`,
                            transform: 'translate(-4px, -4px)',
                        }}
                    />
                </div>
            )}
        </section>
    );
};
