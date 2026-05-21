import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupConsoleTracking, initConsoleTracking } from '../sdk/consoleTracking.js';
import { mergeWebConfig } from '../sdk/config.js';

describe('web console tracking', () => {
  const originalConsole = console;

  afterEach(() => {
    cleanupConsoleTracking();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function stubConsole() {
    const fakeConsole = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    vi.stubGlobal('console', fakeConsole);
    return fakeConsole;
  }

  it('captures console output as normalized log events and preserves original behavior', () => {
    vi.setSystemTime(new Date('2026-05-21T04:30:00.000Z'));
    const fakeConsole = stubConsole();
    const originalWarn = fakeConsole.warn;
    const events: any[] = [];

    initConsoleTracking(mergeWebConfig('rj_live_test'), (event) => events.push(event));

    console.warn('checkout failed', { status: 500 });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'log',
      timestamp: 1779337800000,
      level: 'warn',
      message: 'checkout failed {"status":500}',
      name: 'console.warn',
      properties: {
        level: 'warn',
        message: 'checkout failed {"status":500}',
        source: 'console',
      },
    });
    expect(originalWarn).toHaveBeenCalledWith('checkout failed', { status: 500 });
  });

  it('does not capture when console tracking is disabled', () => {
    const fakeConsole = stubConsole();
    const events: any[] = [];

    initConsoleTracking(mergeWebConfig('rj_live_test', { trackConsoleLogs: false }), (event) => events.push(event));

    console.error('hidden');

    expect(events).toEqual([]);
    expect(fakeConsole.error).toHaveBeenCalledWith('hidden');
  });

  it('restores console handlers on cleanup', () => {
    const fakeConsole = stubConsole();
    const originalLog = fakeConsole.log;

    initConsoleTracking(mergeWebConfig('rj_live_test'), () => undefined);
    expect(console.log).not.toBe(originalLog);

    cleanupConsoleTracking();

    expect(console.log).toBe(originalLog);
    expect(originalConsole.log).toBeTypeOf('function');
  });
});
