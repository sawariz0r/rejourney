type EdgeSignalProperties = Record<string, string | number | boolean>;

declare global {
  interface Window {
    zaraz?: {
      track?: (eventName: string, eventProperties?: EdgeSignalProperties) => Promise<unknown> | unknown;
    };
  }
}

type ZarazTrack = NonNullable<NonNullable<Window["zaraz"]>["track"]>;

export type AccountActivationMethod = "otp" | "github";

const SIGNAL_BUDGET_MS = 3500;
const MIN_TRACK_DISPATCH_MS = 1000;
const ZARAZ_READY_CHECK_INTERVAL_MS = 50;

function signalTimeout(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
}

function getZarazTrack(): ZarazTrack | null {
  const track = window.zaraz?.track;
  if (typeof track !== "function") return null;

  return track.bind(window.zaraz);
}

async function waitForZarazTrack(deadline: number): Promise<ZarazTrack | null> {
  while (Date.now() < deadline) {
    const track = getZarazTrack();
    if (track) return track;

    await signalTimeout(Math.min(ZARAZ_READY_CHECK_INTERVAL_MS, Math.max(deadline - Date.now(), 0)));
  }

  return getZarazTrack();
}

export async function trackAccountActivationSignal(method: AccountActivationMethod): Promise<void> {
  if (typeof window === "undefined") return;

  const deadline = Date.now() + SIGNAL_BUDGET_MS;
  const track = await waitForZarazTrack(deadline);
  if (!track) return;

  try {
    const dispatchTimeoutMs = Math.max(deadline - Date.now(), MIN_TRACK_DISPATCH_MS);
    await Promise.race([
      Promise.resolve(track("account_activated", { method })),
      signalTimeout(dispatchTimeoutMs),
    ]);
  } catch {
    // This is a best-effort edge analytics signal. It must never block login.
  }
}
