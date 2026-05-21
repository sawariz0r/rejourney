import type { RejourneyEvent, RejourneyWebConfig } from './types.js';

type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';
type ConsoleFn = (...args: unknown[]) => void;

const MAX_CONSOLE_LOGS_PER_SESSION = 1000;
const MAX_CONSOLE_MESSAGE_LENGTH = 2000;
const SELF_LOG_PREFIX = '[Rejourney]';

const originalConsoleFns: Partial<Record<ConsoleLevel, ConsoleFn>> = {};
let consoleTrackingActive = false;
let consoleLogCount = 0;

function stringifyConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) {
    const stackHint = arg.stack ? '\n...' : '';
    return `${arg.name}: ${arg.message}${stackHint}`;
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function truncateMessage(message: string): string {
  if (message.length <= MAX_CONSOLE_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_CONSOLE_MESSAGE_LENGTH)}...`;
}

function shouldSkipConsoleMessage(message: string): boolean {
  return message.startsWith(SELF_LOG_PREFIX);
}

function buildConsoleMessage(args: unknown[]): string {
  return args.map(stringifyConsoleArg).join(' ');
}

function createConsoleInterceptor(
  level: ConsoleLevel,
  originalFn: ConsoleFn,
  emit: (event: RejourneyEvent) => void,
): ConsoleFn {
  return (...args: unknown[]) => {
    try {
      const message = buildConsoleMessage(args);
      if (
        message &&
        consoleLogCount < MAX_CONSOLE_LOGS_PER_SESSION &&
        !shouldSkipConsoleMessage(message)
      ) {
        consoleLogCount++;
        const truncatedMessage = truncateMessage(message);
        emit({
          type: 'log',
          timestamp: Date.now(),
          level,
          message: truncatedMessage,
          name: `console.${level}`,
          properties: {
            level,
            message: truncatedMessage,
            source: 'console',
          },
          payload: {
            level,
            message: truncatedMessage,
            source: 'console',
          },
        });
      }
    } catch {
      // Console interception must never alter application behavior.
    }

    originalFn.apply(console, args);
  };
}

export function initConsoleTracking(config: RejourneyWebConfig, emit: (event: RejourneyEvent) => void): void {
  if (config.trackConsoleLogs === false || typeof console === 'undefined' || consoleTrackingActive) return;

  const levels: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug'];
  for (const level of levels) {
    const current = console[level];
    if (typeof current !== 'function') continue;
    originalConsoleFns[level] = current as ConsoleFn;
  }

  for (const level of levels) {
    const originalFn = originalConsoleFns[level];
    if (!originalFn) continue;
    console[level] = createConsoleInterceptor(level, originalFn, emit) as typeof console[typeof level];
  }

  consoleLogCount = 0;
  consoleTrackingActive = true;
}

export function cleanupConsoleTracking(): void {
  if (typeof console !== 'undefined') {
    for (const [level, originalFn] of Object.entries(originalConsoleFns) as Array<[ConsoleLevel, ConsoleFn]>) {
      console[level] = originalFn as typeof console[typeof level];
    }
  }

  for (const level of Object.keys(originalConsoleFns) as ConsoleLevel[]) {
    delete originalConsoleFns[level];
  }
  consoleLogCount = 0;
  consoleTrackingActive = false;
}
