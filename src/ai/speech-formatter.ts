import { languageManager } from '../i18n/language-manager';
import { SupportedLanguage } from '../i18n/types';
import { EntityRecord } from './entities';

const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const ISO_DATE =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;

/**
 * Turns machine values (ISO dates, timestamps, UUIDs, enums) into natural,
 * conversational text so the text-to-speech engine speaks them like a human
 * instead of reading them character by character (e.g. "two zero two six dash
 * zero six dash one nine"). For English, dates are spoken as
 * "Nineteenth June, Twenty Twenty-Six".
 */
export class SpeechFormatter {
  formatDateTime(value: unknown, language: SupportedLanguage): string {
    if (!value) return '';
    const raw = String(value).trim();
    // A bare "YYYY-MM-DD" is parsed by JS as UTC midnight, which shifts the day
    // and adds a phantom time in non-UTC zones. Also, machine formats like
    // "YYYY-MM-DDT00:00:00.000Z" should be treated as date-only so they don't
    // introduce spurious timezone-shifted times.
    const dateOnlyMatch = raw.match(
      /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.\d{1,3})?(?:Z|[+-]00:?00)?)?$/,
    );
    const dateOnly = !!dateOnlyMatch;
    const date = dateOnly ? parseLocalDate(dateOnlyMatch[1]) : new Date(raw);
    if (Number.isNaN(date.getTime())) return String(value);

    const timed = !dateOnly && hasTime(date);
    const time = timed ? this.formatTime(date, language) : '';

    if (isSameDay(date, daysFromNow(0))) {
      return timed
        ? languageManager.t('date.todayAt', language, { time })
        : languageManager.t('date.today', language);
    }
    if (isSameDay(date, daysFromNow(1))) {
      return timed
        ? languageManager.t('date.tomorrowAt', language, { time })
        : languageManager.t('date.tomorrow', language);
    }

    const datePart = this.formatDate(date, language);
    if (!timed) return datePart;
    return languageManager.t('date.dateAtTime', language, {
      date: datePart,
      time,
    });
  }

  formatDuration(minutes: unknown, language: SupportedLanguage): string {
    const total = Number(minutes);
    if (!Number.isFinite(total) || total <= 0) return String(minutes ?? '');
    const hours = Math.floor(total / 60);
    const mins = Math.round(total % 60);
    if (!hours) {
      return languageManager.t('duration.minutes', language, { count: mins });
    }
    if (!mins) {
      return languageManager.t('duration.hours', language, { count: hours });
    }
    return languageManager.t('duration.hoursMinutes', language, {
      hours,
      minutes: mins,
    });
  }

  formatEstimatedTime(hoursVal: unknown, language: SupportedLanguage): string {
    const total = Number(hoursVal);
    if (!Number.isFinite(total) || total < 0) return String(hoursVal ?? '');

    const days = Math.floor(total / 24);
    const remainingHours = total % 24;
    const hours = Math.floor(remainingHours);
    const minutes = Math.round((remainingHours - hours) * 60);

    const parts: string[] = [];

    if (language === 'sr') {
      if (days > 0) {
        parts.push(`${days} ${getSrPlural(days, 'dan', 'dana', 'dana')}`);
      }
      if (hours > 0) {
        parts.push(`${hours} ${getSrPlural(hours, 'sat', 'sata', 'sati')}`);
      }
      if (minutes > 0) {
        parts.push(
          `${minutes} ${getSrPlural(minutes, 'minut', 'minuta', 'minuta')}`,
        );
      }
    } else {
      if (days > 0) {
        parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
      }
      if (hours > 0) {
        parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
      }
      if (minutes > 0) {
        parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
      }
    }

    return parts.join(', ') || `0 ${language === 'sr' ? 'minuta' : 'minutes'}`;
  }

  formatValue(value: unknown, language: SupportedLanguage): string {
    if (Array.isArray(value)) {
      return value.map((v) => this.formatValue(v, language)).join(', ');
    }
    const text = String(value ?? '');
    if (!text) return '';
    if (ISO_DATE.test(text)) {
      ISO_DATE.lastIndex = 0;
      return text.replace(ISO_DATE, (match) =>
        this.formatDateTime(match, language),
      );
    }
    ISO_DATE.lastIndex = 0;
    return this.humanizeEnum(this.hideInternalIds(text, language), language);
  }

  formatRecord(record: EntityRecord, language: SupportedLanguage): string {
    const date = record.date ? this.formatDateTime(record.date, language) : '';
    const status = record.status
      ? this.humanizeEnum(record.status, language)
      : '';
    const parts = [record.title, date, status].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Final normalization pass over a complete reply, applied right before
   * text-to-speech. Replaces every ISO date/timestamp with natural spoken text
   * and hides internal UUIDs. Safe to call on already-formatted text (only raw
   * machine tokens are touched).
   */
  sanitizeForSpeech(text: string, language: SupportedLanguage): string {
    if (!text) return text;
    ISO_DATE.lastIndex = 0;
    const withDates = text.replace(ISO_DATE, (match) =>
      this.formatDateTime(match, language),
    );
    ISO_DATE.lastIndex = 0;
    return this.hideInternalIds(withDates, language);
  }

  private formatDate(date: Date, language: SupportedLanguage): string {
    if (language === 'en') {
      const day = ordinalDay(date.getDate());
      const month = MONTHS_EN[date.getMonth()];
      const year = yearToWords(date.getFullYear());
      return `${day} ${month}, ${year}`;
    }
    return new Intl.DateTimeFormat(locale(language), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private formatTime(date: Date, language: SupportedLanguage): string {
    if (language === 'en') {
      return timeToWords(date);
    }
    return new Intl.DateTimeFormat(locale(language), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private humanizeEnum(value: string, language: SupportedLanguage): string {
    const s = value.trim().toLowerCase();
    const canonicalKeys = [
      'meeting',
      'kick-off',
      'training',
      'workshop',
      'conference',
      'presentation',
      'interview',
      'trip',
      'low',
      'standard',
      'high',
      'extreme',
      'normal',
      'urgent',
      'idea',
      'reminder',
      'personal',
    ];

    let matchedKey: string | undefined;
    for (const k of canonicalKeys) {
      if (k === s) {
        matchedKey = k;
        break;
      }
      for (const lang of ['en', 'sr'] as const) {
        const translated = languageManager.t(`enum.${k}`, lang);
        if (translated.toLowerCase() === s) {
          matchedKey = k;
          break;
        }
      }
      if (matchedKey) break;
    }

    if (matchedKey) {
      return languageManager.t(`enum.${matchedKey}`, language);
    }

    return value.replace(/[_-]+/g, ' ');
  }

  private hideInternalIds(value: string, language: SupportedLanguage): string {
    return value.replace(UUID, languageManager.t('speech.hiddenId', language));
  }
}

function locale(language: SupportedLanguage): string {
  return language === 'sr' ? 'sr-Latn-RS' : 'en-US';
}

function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hasTime(date: Date): boolean {
  return (
    date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0
  );
}

// ---------------------------------------------------------------------------
// English number-to-words helpers (for natural, conversational speech).
// ---------------------------------------------------------------------------

const MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
];
const TEENS = [
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

const ORDINAL_ONES = [
  '',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
];
const ORDINAL_TEENS = [
  'Tenth',
  'Eleventh',
  'Twelfth',
  'Thirteenth',
  'Fourteenth',
  'Fifteenth',
  'Sixteenth',
  'Seventeenth',
  'Eighteenth',
  'Nineteenth',
];

/** 0-99 in title-cased words, e.g. 26 -> "Twenty-Six". */
function twoDigitWords(n: number): string {
  if (n <= 0) return 'Zero';
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10;
  return ones ? `${tens}-${ONES[ones]}` : tens;
}

/** Day of month as an ordinal word, e.g. 19 -> "Nineteenth", 25 -> "Twenty-Fifth". */
function ordinalDay(day: number): string {
  if (day <= 0 || day > 31) return String(day);
  if (day < 10) return ORDINAL_ONES[day];
  if (day < 20) return ORDINAL_TEENS[day - 10];
  const tens = Math.floor(day / 10);
  const ones = day % 10;
  const tensWord = tens === 2 ? 'Twenty' : 'Thirty';
  if (ones === 0) return tens === 2 ? 'Twentieth' : 'Thirtieth';
  return `${tensWord}-${ORDINAL_ONES[ones]}`;
}

/** Four-digit year spoken naturally, e.g. 2026 -> "Twenty Twenty-Six". */
function yearToWords(year: number): string {
  if (year < 1000 || year > 9999) return String(year);
  const high = Math.floor(year / 100);
  const low = year % 100;
  // 2000-2009 read as "Two Thousand (X)".
  if (year >= 2000 && year <= 2009) {
    return low === 0 ? 'Two Thousand' : `Two Thousand ${twoDigitWords(low)}`;
  }
  if (low === 0) return `${twoDigitWords(high)} Hundred`;
  if (low < 10) return `${twoDigitWords(high)} Oh ${twoDigitWords(low)}`;
  return `${twoDigitWords(high)} ${twoDigitWords(low)}`;
}

/** Clock time spoken naturally, e.g. 09:00 -> "Nine AM", 14:30 -> "Two Thirty PM". */
function timeToWords(date: Date): string {
  const minutes = date.getMinutes();
  const meridiem = date.getHours() < 12 ? 'AM' : 'PM';
  let hour = date.getHours() % 12;
  if (hour === 0) hour = 12;
  const hourWord = twoDigitWords(hour);
  if (minutes === 0) return `${hourWord} ${meridiem}`;
  if (minutes < 10) {
    return `${hourWord} Oh ${twoDigitWords(minutes)} ${meridiem}`;
  }
  return `${hourWord} ${twoDigitWords(minutes)} ${meridiem}`;
}

function getSrPlural(
  n: number,
  singular: string,
  dual: string,
  plural: string,
): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return singular;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return dual;
  }
  return plural;
}
