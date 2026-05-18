/**
 * Domain Utilities
 */

/**
 * Extract the base domain (e.g., "rejourney.co" from "www.rejourney.co" or "api.rejourney.co")
 */
export function getBaseDomain(hostname: string): string {
    // Remove www. prefix if present
    const withoutWww = hostname.replace(/^www\./, '');

    // Check if it's an IP address
    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(withoutWww)) {
        return withoutWww;
    }

    // Extract domain and TLD (handles .co, .com, etc.)
    const parts = withoutWww.split('.');
    if (parts.length >= 2) {
        return parts.slice(-2).join('.');
    }
    return withoutWww;
}

/**
 * Compare two hostnames to see if they share the same base domain
 */
export function isSameBaseDomain(hostnameA: string, hostnameB: string): boolean {
    if (!hostnameA || !hostnameB) return false;

    // Direct matches (including subdomains or exact matches)
    if (hostnameA === hostnameB) return true;

    // Base domain matches
    return getBaseDomain(hostnameA) === getBaseDomain(hostnameB);
}

export function splitOriginList(value: string | undefined): string[] {
    return (value || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export function isOriginAllowedByList(origin: string | undefined, allowedOrigins: string[]): boolean {
    if (!origin) return true;

    for (const allowedOrigin of allowedOrigins) {
        if (origin === allowedOrigin) return true;

        try {
            const allowedUrl = new URL(allowedOrigin);
            const originUrl = new URL(origin);
            if (getBaseDomain(allowedUrl.hostname) === getBaseDomain(originUrl.hostname)) {
                return true;
            }
        } catch {
            // Ignore malformed configured or request origins.
        }
    }

    return false;
}
