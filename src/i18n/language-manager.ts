import en from './locales/en';
import sr from './locales/sr';
import {
  DEFAULT_LANGUAGE,
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  TranslationTable,
  TranslationVars,
} from './types';

const LOCALES: Record<SupportedLanguage, TranslationTable> = { en, sr };

// Cyrillic block — any Cyrillic strongly implies Serbian here.
const CYRILLIC = /[\u0400-\u04FF]/;
// Serbian-specific Latin diacritics.
const SERBIAN_DIACRITICS = /[čćžšđ]/i;
// Common Serbian command/keywords (Latin), used as a lightweight fallback.
const SERBIAN_WORDS =
  /\b(kreiraj|napravi|dodaj|obriši|obrisi|izmeni|ažuriraj|azuriraj|zadatak|beleška|beleska|događaj|dogadjaj|sastanak|podseti|podsetnik|sutra|danas|juče|juce|hvala|molim|želim|zelim|napiši|napisi|prikaži|prikazi|koliko)\b/i;

/**
 * Centralized language service: detection, normalization, and translation.
 * Used by the conversation manager, voice session, and HTTP middleware so
 * language handling is consistent everywhere.
 */
export class LanguageManager {
  readonly defaultLanguage: SupportedLanguage = DEFAULT_LANGUAGE;
  readonly supportedLanguages: readonly SupportedLanguage[] =
    SUPPORTED_LANGUAGES;

  isSupported(code: string | undefined | null): code is SupportedLanguage {
    return (
      !!code &&
      (SUPPORTED_LANGUAGES as readonly string[]).includes(code.toLowerCase())
    );
  }

  /** Maps a BCP-47 tag (e.g. "sr-RS", "en-US") to a supported code, else default. */
  normalize(tag?: string | null): SupportedLanguage {
    if (!tag) return this.defaultLanguage;
    const base = tag.toLowerCase().split(/[-_]/)[0];
    return this.isSupported(base) ? base : this.defaultLanguage;
  }

  /**
   * Heuristic detection from free text. Returns null when undecidable so the
   * caller can keep the existing session language instead of forcing a switch.
   */
  detect(text: string | undefined | null): SupportedLanguage | null {
    if (!text) return null;
    if (CYRILLIC.test(text)) return 'sr';
    if (SERBIAN_DIACRITICS.test(text)) return 'sr';
    if (SERBIAN_WORDS.test(text)) return 'sr';
    // Plain ASCII Latin with no Serbian markers — assume English.
    if (/[a-z]/i.test(text)) return 'en';
    return null;
  }

  detectOrDefault(text: string | undefined | null): SupportedLanguage {
    return this.detect(text) ?? this.defaultLanguage;
  }

  /** Picks the best language from a request's Accept-Language header. */
  fromAcceptLanguage(header?: string | null): SupportedLanguage {
    if (!header) return this.defaultLanguage;
    for (const part of header.split(',')) {
      const tag = part.split(';')[0].trim();
      const code = this.normalize(tag);
      if (this.isSupported(tag.split(/[-_]/)[0])) return code;
    }
    return this.defaultLanguage;
  }

  /** Translates a key into `lang`, interpolating {var} placeholders. */
  t(
    key: string,
    lang: SupportedLanguage = this.defaultLanguage,
    vars?: TranslationVars,
  ): string {
    const table = LOCALES[lang] ?? LOCALES[this.defaultLanguage];
    let value =
      table[key] ?? LOCALES[this.defaultLanguage][key] ?? key;
    if (vars) {
      for (const [name, raw] of Object.entries(vars)) {
        value = value.split(`{${name}}`).join(String(raw));
      }
    }
    return value;
  }

  /** Localized noun for an intent (e.g. "task" / "zadatak"). */
  noun(intent: string, lang: SupportedLanguage): string {
    return this.t(`noun.${intent}`, lang);
  }
}

/** Shared singleton. */
export const languageManager = new LanguageManager();
