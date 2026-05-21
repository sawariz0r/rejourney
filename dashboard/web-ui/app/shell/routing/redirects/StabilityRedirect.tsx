import { redirect } from "react-router";

type StabilityFilter = "crashes" | "anrs" | "errors";

const LEGACY_STABILITY_PATH_RE = /^(.*\/stability)\/(crashes|anrs|errors)(?:\/([^/]+)\/([^/]+))?\/?$/;

function buildStabilityRedirectUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  const match = url.pathname.match(LEGACY_STABILITY_PATH_RE);

  if (!match) {
    return url.pathname.replace(/\/stability\/.*$/, "/stability") + url.search + url.hash;
  }

  const [, stabilityBasePath, legacyTab, , legacyIssueId] = match;
  const searchParams = new URLSearchParams(url.search);

  // 2026-05-21: Stability was collapsed from three sidebar pages into one
  // canonical page so saved workspace tabs and old deep links do not spawn
  // separate Crashes, ANRs, and Errors tabs anymore.
  searchParams.set("filter", legacyTab as StabilityFilter);
  searchParams.delete("tab");
  if (legacyIssueId && !searchParams.has("focusId")) {
    searchParams.set("focusId", decodeURIComponent(legacyIssueId));
  }

  const search = searchParams.toString();
  return `${stabilityBasePath}${search ? `?${search}` : ""}${url.hash}`;
}

export function loader({ request }: { request: Request }) {
  return redirect(buildStabilityRedirectUrl(request.url));
}

export default function StabilityRedirect() {
  return null;
}
