import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackAccountActivationSignal } from './edgeSignals';

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

function setTestWindow(value: unknown) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value,
  });
}

function restoreWindow() {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
    return;
  }

  delete (globalThis as { window?: unknown }).window;
}

describe('edge signals', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    restoreWindow();
  });

  it('sends account activation through Zaraz when the tracker is ready', async () => {
    const track = vi.fn().mockResolvedValue(undefined);
    setTestWindow({
      setTimeout,
      zaraz: { track },
    });

    await trackAccountActivationSignal('otp');

    expect(track).toHaveBeenCalledWith('account_activated', { method: 'otp' });
  });

  it('waits briefly for Zaraz to initialize before giving up', async () => {
    vi.useFakeTimers();
    const track = vi.fn().mockResolvedValue(undefined);
    const testWindow = {
      setTimeout,
      zaraz: {},
    };
    setTestWindow(testWindow);

    const signal = trackAccountActivationSignal('github');
    await vi.advanceTimersByTimeAsync(100);
    testWindow.zaraz = { track };
    await vi.advanceTimersByTimeAsync(50);
    await signal;

    expect(track).toHaveBeenCalledWith('account_activated', { method: 'github' });
  });

  it('does not fail login when Zaraz never becomes available', async () => {
    vi.useFakeTimers();
    setTestWindow({
      setTimeout,
      zaraz: {},
    });

    const signal = trackAccountActivationSignal('otp');
    await vi.advanceTimersByTimeAsync(3500);

    await expect(signal).resolves.toBeUndefined();
  });
});
