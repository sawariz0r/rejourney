import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeWebConfig } from '../sdk/config.js';
import { buildLinkClickContext } from '../sdk/interactionTracking.js';

function makeAnchor(options: {
  href: string;
  rawHref?: string;
  text?: string;
  target?: string;
  rel?: string;
  download?: boolean;
}): HTMLAnchorElement {
  return {
    tagName: 'A',
    href: options.href,
    target: options.target || '',
    rel: options.rel || '',
    textContent: options.text || '',
    getAttribute: (name: string) => {
      if (name === 'href') return options.rawHref || options.href;
      if (name === 'aria-label') return null;
      if (name === 'title') return null;
      return null;
    },
    hasAttribute: (name: string) => name === 'download' && options.download === true,
  } as unknown as HTMLAnchorElement;
}

function makeClick(anchor: HTMLAnchorElement): MouseEvent {
  return {
    composedPath: () => [anchor],
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
  } as unknown as MouseEvent;
}

describe('web interaction tracking', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds scrubbed link click context for same-origin anchors', () => {
    vi.stubGlobal('window', {
      location: new URL('https://app.example.com/home'),
    });

    const anchor = makeAnchor({
      href: 'https://app.example.com/pricing?utm_source=newsletter&token=secret',
      rawHref: '/pricing?utm_source=newsletter&token=secret',
      text: 'Pricing for jane@example.com',
      target: '_blank',
      rel: 'noopener',
    });

    const link = buildLinkClickContext(makeClick(anchor), mergeWebConfig('rj_live_test'));

    expect(link).toMatchObject({
      href: 'https://app.example.com/pricing?utm_source=newsletter&token=%5BREDACTED%5D',
      path: '/pricing?utm_source=newsletter&token=%5BREDACTED%5D',
      host: 'app.example.com',
      protocol: 'https',
      text: 'Pricing for [email]',
      target: '_blank',
      rel: 'noopener',
      download: false,
      external: false,
      sameOrigin: true,
      modifierKey: false,
    });
  });

  it('can disable automatic link context capture', () => {
    vi.stubGlobal('window', {
      location: new URL('https://app.example.com/home'),
    });

    const anchor = makeAnchor({
      href: 'https://docs.example.com/start?utm_campaign=launch',
    });

    const link = buildLinkClickContext(makeClick(anchor), mergeWebConfig('rj_live_test', {
      autoTrackLinks: false,
    }));

    expect(link).toBeNull();
  });

  it('redacts non-http link destinations', () => {
    vi.stubGlobal('window', {
      location: new URL('https://app.example.com/home'),
    });

    const anchor = makeAnchor({
      href: 'mailto:jane@example.com',
      text: 'Contact Jane',
    });

    const link = buildLinkClickContext(makeClick(anchor), mergeWebConfig('rj_live_test'));

    expect(link).toMatchObject({
      href: 'mailto:[email]',
      path: null,
      host: null,
      protocol: 'mailto',
      external: true,
      sameOrigin: false,
    });
  });
});
