import { redirect } from "react-router";
import { isIssueDetectionUiEnabled } from "~/shared/config/runtimeEnv";

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/$/, "");
  const defaultPath = isIssueDetectionUiEnabled() ? "leaks" : "general";
  return redirect(`${pathname}/${defaultPath}${url.search}`);
}

export default function AppIndexRedirect() {
  return null;
}
