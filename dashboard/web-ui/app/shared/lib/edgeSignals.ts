type EdgeSignalProperties = Record<string, string | number | boolean>;

declare global {
  interface Window {
    zaraz?: {
      track?: (eventName: string, eventProperties?: EdgeSignalProperties) => Promise<unknown> | unknown;
    };
  }
}

export type AccountActivationMethod = "otp" | "github";

const SIGNAL_TIMEOUT_MS = 750;

function signalTimeout(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, SIGNAL_TIMEOUT_MS);
  });
}

export async function trackAccountActivationSignal(method: AccountActivationMethod): Promise<void> {
  if (typeof window === "undefined") return;

  const track = window.zaraz?.track;
  if (typeof track !== "function") return;

  try {
    await Promise.race([
      Promise.resolve(track("account_activated", { method })),
      signalTimeout(),
    ]);
  } catch {
    // This is a best-effort edge analytics signal. It must never block login.
  }
}
