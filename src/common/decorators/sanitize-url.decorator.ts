import { Transform } from 'class-transformer';

/**
 * Class-transformer decorator that collapses double-slashes in a URL string
 * down to a single slash, while preserving protocol separators (e.g. "://").
 *
 * Usage:
 *   @Expose()
 *   @SanitizeUrl()
 *   avatar_url: string;
 */
export function SanitizeUrl(): PropertyDecorator {

    return Transform(({ value }) => {
        console.log(value)
        if (typeof value !== 'string') return value;
        // Replace any "//" NOT preceded by ":" (handles http://, https://, etc.)
        return value.replace(/(?<!:)\/\//g, '/');
    });
}
