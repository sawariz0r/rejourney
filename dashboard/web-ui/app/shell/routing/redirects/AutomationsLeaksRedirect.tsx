import { redirect } from "react-router";

export function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/automations\/leaks\/?$/, "/leaks");
  return redirect(`${pathname}${url.search}${url.hash}`);
}

export default function AutomationsLeaksRedirect() {
  return null;
}
