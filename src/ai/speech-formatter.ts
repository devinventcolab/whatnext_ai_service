import { languageManager } from '../i18n/language-manager';
import { SupportedLanguage } from '../i18n/types';
import { EntityRecord } from './entities';

const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const ISO_DATE =
  /\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;

export class SpeechFormatter {
  formatDateTime(value: unknown, language: SupportedLanguage): string {
    if (!value) return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);

    if (isSameDay(date, daysFromNow(0))) {
      return languageManager.t('date.todayAt', language, {
        time: this.formatTime(date, language),
      });
    }
    if (isSameDay(date, daysFromNow(1))) {
      return languageManager.t('date.tomorrowAt', language, {
        time: this.formatTime(date, language),
      });
    }

    return new Intl.DateTimeFormat(locale(language), {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: hasTime(date) ? 'numeric' : undefined,
      minute: hasTime(date) ? '2-digit' : undefined,
    }).format(date);
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

  sanitizeForSpeech(text: string, language: SupportedLanguage): string {
    ISO_DATE.lastIndex = 0;
    const withDates = text.replace(ISO_DATE, (match) =>
      this.formatDateTime(match, language),
    );
    ISO_DATE.lastIndex = 0;
    return this.hideInternalIds(withDates, language);
  }

  private formatTime(date: Date, language: SupportedLanguage): string {
    return new Intl.DateTimeFormat(locale(language), {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private humanizeEnum(value: string, language: SupportedLanguage): string {
    const key = `enum.${value}`;
    const translated = languageManager.t(key, language);
    if (translated !== key) return translated;
    return value.replace(/[_-]+/g, ' ');
  }

  private hideInternalIds(value: string, language: SupportedLanguage): string {
    return value.replace(UUID, languageManager.t('speech.hiddenId', language));
  }
}

function locale(language: SupportedLanguage): string {
  return language === 'sr' ? 'sr-Latn-RS' : 'en-US';
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
    date.getHours() !== 0 ||
    date.getMinutes() !== 0 ||
    date.getSeconds() !== 0
  );
}
