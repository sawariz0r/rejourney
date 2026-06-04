import { Globe2 } from 'lucide-react';
import { countryCodeToTwemojiFlagAssetNames } from '~/shared/lib/geoDisplay';
import { cn } from '~/shared/lib/cn';

interface CountryFlagProps {
    countryCode?: string | null;
    countryLabel?: string | null;
    className?: string;
    imageClassName?: string;
    fallbackClassName?: string;
    decorative?: boolean;
}

const TWEMOJI_FLAG_BASE_PATH = '/images/flags/twemoji';

export function CountryFlag({
    countryCode,
    countryLabel,
    className,
    imageClassName,
    fallbackClassName,
    decorative = false,
}: CountryFlagProps) {
    const assetNames = countryCodeToTwemojiFlagAssetNames(countryCode);

    if (assetNames.length === 0) {
        return (
            <Globe2
                className={cn('h-4 w-4 shrink-0 text-slate-400', fallbackClassName, className)}
                aria-hidden={decorative || undefined}
                aria-label={decorative ? undefined : 'Unknown location'}
                role={decorative ? undefined : 'img'}
            />
        );
    }

    return (
        <span
            className={cn('inline-flex shrink-0 items-center gap-0.5 align-middle', className)}
            role={decorative ? undefined : 'img'}
            aria-label={decorative ? undefined : `${countryLabel || 'Country'} flag`}
            aria-hidden={decorative || undefined}
        >
            {assetNames.map((assetName) => (
                <img
                    key={assetName}
                    src={`${TWEMOJI_FLAG_BASE_PATH}/${assetName}.svg`}
                    alt=""
                    className={cn('h-4 w-4 shrink-0 object-contain', imageClassName)}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                />
            ))}
        </span>
    );
}
