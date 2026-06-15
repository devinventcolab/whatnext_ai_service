/**
 * Add a new language in three steps:
 *   1. Add its code to SUPPORTED_LANGUAGES below.
 *   2. Create src/i18n/locales/<code>.ts (copy en.ts and translate the values).
 *   3. Register it in src/i18n/language-manager.ts (LOCALES map).
 */
export const DEFAULT_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGES = ['en', 'sr'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Flat translation table: dotted key -> localized string (with {var} slots). */
export type TranslationTable = Record<string, string>;

export type TranslationVars = Record<string, string | number>;
