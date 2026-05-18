import { Button } from "./Button";

interface AuthServiceUnavailableProps {
  detail?: string | null;
  isRetrying?: boolean;
  onRetry?: () => void;
  variant?: "screen" | "panel";
}

export function AuthServiceUnavailable({
  detail,
  isRetrying = false,
  onRetry,
  variant = "screen",
}: AuthServiceUnavailableProps) {
  const content = (
    <div className="w-full max-w-md border-2 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <div className="mb-4 inline-flex border-2 border-amber-500 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
        Auth service unavailable
      </div>
      <h1 className="mb-3 text-2xl font-black uppercase tracking-tight text-slate-950">
        Sign-in Error
      </h1>
      <p className="mb-4 text-sm font-semibold leading-6 text-slate-700">
        Rejourney cannot reach the authentication service right now. 
      </p>
      {detail && (
        <p className="mb-4 border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-600">
          {detail}
        </p>
      )}
      {onRetry && (
        <Button
          type="button"
          variant="primary"
          onClick={onRetry}
          disabled={isRetrying}
          className="w-full rounded-none bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all h-12 font-black uppercase tracking-widest text-sm hover:bg-gray-900"
        >
          {isRetrying ? "Checking..." : "Retry"}
        </Button>
      )}
    </div>
  );

  if (variant === "panel") {
    return content;
  }

  return (
    <main className="public-readable-scope min-h-screen bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] flex items-center justify-center p-4 font-sans text-gray-900">
      {content}
    </main>
  );
}
