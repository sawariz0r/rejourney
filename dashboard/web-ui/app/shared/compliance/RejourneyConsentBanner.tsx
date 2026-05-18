import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Cookie, ShieldCheck, ShieldX } from "lucide-react";
import { useAuth } from "~/shared/providers/AuthContext";
import { useTeam } from "~/shared/providers/TeamContext";
import {
    disableRejourneyWebsiteTelemetry,
    isEmbeddedFrame,
    isOfficialWebsiteHost,
    readStoredRejourneyConsent,
    startRejourneyWebsiteTelemetry,
    trackRejourneyConsentAccepted,
    trackRejourneyRouteView,
    writeStoredRejourneyConsent,
} from "~/shared/compliance/rejourneyWebsiteTelemetry";

type ConsentState = "loading" | "pending" | "accepted" | "rejected" | "disabled";

export function RejourneyConsentBanner() {
    const location = useLocation();
    const { user } = useAuth();
    const { currentTeam, teams } = useTeam();
    const [consentState, setConsentState] = useState<ConsentState>("loading");
    const [startSource, setStartSource] = useState<"stored_consent" | "banner_accept">("stored_consent");

    useEffect(() => {
        if (typeof window === "undefined") return;

        if (isEmbeddedFrame() || !isOfficialWebsiteHost(window.location.hostname)) {
            setConsentState("disabled");
            disableRejourneyWebsiteTelemetry();
            return;
        }

        const storedValue = readStoredRejourneyConsent();

        if (storedValue === "accepted") {
            setStartSource("stored_consent");
            setConsentState("accepted");
            return;
        }

        disableRejourneyWebsiteTelemetry();

        if (storedValue === "rejected") {
            setConsentState("rejected");
            return;
        }

        setConsentState("pending");
    }, []);

    useEffect(() => {
        if (consentState !== "accepted") return;

        void startRejourneyWebsiteTelemetry({
            pathname: location.pathname,
            search: location.search,
            userId: user?.id ?? null,
            currentTeam,
            teams,
            source: startSource,
        })
            .then((started) => {
                if (!started) return;
                if (startSource === "banner_accept") {
                    trackRejourneyConsentAccepted();
                }
                trackRejourneyRouteView({
                    pathname: location.pathname,
                    search: location.search,
                    userId: user?.id ?? null,
                    currentTeam,
                    teams,
                });
            })
            .catch(() => {
                // The SDK logs its own startup diagnostics when debug logging is enabled.
            });
    }, [consentState, currentTeam, location.pathname, location.search, startSource, teams, user?.id]);

    useEffect(() => {
        if (consentState !== "accepted") return;

        trackRejourneyRouteView({
            pathname: location.pathname,
            search: location.search,
            userId: user?.id ?? null,
            currentTeam,
            teams,
        });
    }, [consentState, currentTeam, location.pathname, location.search, teams, user?.id]);

    const acceptAnalytics = () => {
        writeStoredRejourneyConsent("accepted");
        setStartSource("banner_accept");
        setConsentState("accepted");
    };

    const rejectAnalytics = () => {
        writeStoredRejourneyConsent("rejected");
        setConsentState("rejected");
        disableRejourneyWebsiteTelemetry();
    };

    if (consentState !== "pending") {
        return null;
    }

    return (
        <aside className="fixed bottom-3 left-3 right-3 z-[90] sm:bottom-4 sm:left-auto sm:right-4 sm:w-[min(25rem,calc(100vw-2rem))]">
            <div className="overflow-hidden border-2 border-black bg-white text-black shadow-neo">
                <div className="grid h-2 grid-cols-4 border-b-2 border-black">
                    <span className="bg-[#67e8f9]" />
                    <span className="bg-[#fef08a]" />
                    <span className="bg-[#f9a8d4]" />
                    <span className="bg-[#86efac]" />
                </div>
                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-black bg-[#67e8f9] shadow-neo-sm">
                            <Cookie className="h-5 w-5 stroke-[3]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-extrabold leading-tight">Allow website analytics?</p>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">
                                We use our own Rejourney web SDK to understand page flows, performance, and product friction. It is optional, masked by default, and the site works without it.
                            </p>
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                        <button
                            type="button"
                            onClick={rejectAnalytics}
                            className="inline-flex min-h-10 items-center justify-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-extrabold text-black shadow-neo-sm transition hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-neo"
                        >
                            <ShieldX className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                            Essential only
                        </button>
                        <button
                            type="button"
                            onClick={acceptAnalytics}
                            className="inline-flex min-h-10 items-center justify-center gap-2 border-2 border-black bg-[#67e8f9] px-3 py-2 text-xs font-extrabold text-black shadow-neo-sm transition hover:-translate-y-0.5 hover:bg-[#22d3ee] hover:shadow-neo"
                        >
                            <ShieldCheck className="h-4 w-4 stroke-[3]" aria-hidden="true" />
                            Allow replay
                        </button>
                    </div>
                    <a
                        href="/privacy-policy"
                        className="mt-3 inline-flex text-xs font-extrabold text-black underline decoration-2 underline-offset-4 hover:text-slate-700"
                    >
                        Privacy policy
                    </a>
                </div>
            </div>
        </aside>
    );
}
