import { redirect } from "react-router";
import { normalizeLegacyAnalyticsAppPath } from "~/shell/routing/dashboardRouteAliases";

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const targetPath = normalizeLegacyAnalyticsAppPath(url.pathname);

  if (targetPath === url.pathname) {
    const fallbackPath = url.pathname.replace(/\/analytics\/?$/, "/general");
    return redirect(`${fallbackPath}${url.search}${url.hash}`);
  }

  return redirect(`${targetPath}${url.search}${url.hash}`);
}

export default function AnalyticsRedirect() {
  return null;
}
