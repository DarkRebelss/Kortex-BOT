export type SupportedLanguage = 'tr' | 'en';
/**
 * Translate a dot-separated key (e.g., 'errors.no_permission') with dynamic parameter substitution.
 */
export declare function t(key: string, params?: Record<string, string | number>, language?: SupportedLanguage): string;
