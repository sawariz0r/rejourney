import { useParams } from "react-router";
import type { Route } from "./+types/route";
import { RecordingDetail } from "~/features/app/sessions/detail/route";
import { SessionDataProvider } from "~/shared/providers/SessionContext";

export const meta: Route.MetaFunction = () => [
    { title: "Shared Replay - Rejourney" },
    { name: "robots", content: "noindex,nofollow" },
    { name: "referrer", content: "no-referrer" },
];

export const headers: Route.HeadersFunction = () => ({
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
});

export default function PublicReplayShareRoute() {
    const { shareToken } = useParams<{ shareToken: string }>();

    return (
        <SessionDataProvider>
            <div className="dashboard-modern min-h-dvh bg-[#f8fafd] font-sans text-black antialiased xl:h-dvh xl:overflow-hidden">
                <RecordingDetail shareToken={shareToken} />
            </div>
        </SessionDataProvider>
    );
}
