export interface GeoLocationLike {
  city?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
}

export interface GeoDisplay {
  countryCode: string | null;
  cityLabel: string | null;
  countryLabel: string | null;
  fullLabel: string;
  hasLocation: boolean;
}

const UNKNOWN_LOCATION_LABEL = 'Unknown location';

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeCountry(
  country: string | null,
  countryCode: string | null
): { country: string | null; countryCode: string | null } {
  const normalizedCode = countryCode?.toUpperCase() ?? null;
  const hasIsraelMention =
    normalizedCode === 'IL' ||
    normalizedCode === 'PS/IL' ||
    (country ? /\bisrael\b/i.test(country) : false);

  if (hasIsraelMention) {
    return {
      country: 'Palestine / Israel',
      countryCode: 'PS/IL',
    };
  }

  return {
    country,
    countryCode: normalizedCode,
  };
}

function getIsoCountryCodes(countryCode: string | null | undefined): string[] {
  if (!countryCode) return [];
  return countryCode
    .toUpperCase()
    .split('/')
    .map((code) => code.trim())
    .filter((code) => /^[A-Z]{2}$/.test(code));
}

export function countryCodeToTwemojiFlagAssetNames(countryCode: string | null | undefined): string[] {
  return getIsoCountryCodes(countryCode).map((code) =>
    Array.from(code)
      .map((char) => (0x1f1e6 + char.charCodeAt(0) - 65).toString(16))
      .join('-')
  );
}

export function formatGeoDisplay(geoLocation: GeoLocationLike | null | undefined): GeoDisplay {
  const city = cleanText(geoLocation?.city);
  const region = cleanText(geoLocation?.region);
  const countryRaw = cleanText(geoLocation?.country);
  const countryCodeRaw = cleanText(geoLocation?.countryCode);
  const normalized = normalizeCountry(countryRaw, countryCodeRaw);
  const countryLabel = normalized.country;

  const fullLabel =
    [city, countryLabel].filter(Boolean).join(', ') ||
    region ||
    countryLabel ||
    UNKNOWN_LOCATION_LABEL;

  const hasLocation = fullLabel !== UNKNOWN_LOCATION_LABEL;

  return {
    countryCode: hasLocation ? normalized.countryCode : null,
    cityLabel: city,
    countryLabel,
    fullLabel,
    hasLocation,
  };
}
