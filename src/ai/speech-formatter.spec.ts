import { normalizeEntityRecord } from './entities';
import { SpeechFormatter } from './speech-formatter';

describe('speech-friendly formatting', () => {
  // Pin "now" so the relative today/tomorrow branches are deterministic and the
  // sample dates below are always treated as absolute dates.
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T08:00:00'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('normalizes note records from .NET response fields', () => {
    const record = normalizeEntityRecord('note', {
      id: 'NOTE-1',
      title: 'Project planning',
      notesText: 'Discuss kickoff',
      createdDate: '2026-06-16T14:30:00Z',
    });

    expect(record.id).toBe('NOTE-1');
    expect(record.title).toBe('Project planning');
    expect(record.summary).toBe('Discuss kickoff');
    expect(record.date).toBe('2026-06-16T14:30:00Z');
  });

  it('does not expose raw UUIDs in spoken text', () => {
    const formatter = new SpeechFormatter();
    const text = formatter.sanitizeForSpeech(
      'Record 174d9101-4e1e-44fb-82a3-87d7a41dc747 was updated.',
      'en',
    );

    expect(text).not.toContain('174d9101');
    expect(text).toContain('internal ID hidden');
  });

  it('speaks ISO dates as natural English instead of character-by-character', () => {
    const formatter = new SpeechFormatter();

    expect(formatter.formatDateTime('2026-06-19', 'en')).toBe(
      'Nineteenth June, Twenty Twenty-Six',
    );
    expect(formatter.formatDateTime('2026-12-25', 'en')).toBe(
      'Twenty-Fifth December, Twenty Twenty-Six',
    );
  });

  it('speaks date-only midnight timestamps without a spurious time', () => {
    const formatter = new SpeechFormatter();

    expect(formatter.formatDateTime('2026-06-20T00:00:00', 'en')).toBe(
      'Twentieth June, Twenty Twenty-Six',
    );
    expect(formatter.formatDateTime('2026-06-20T00:00:00Z', 'en')).toBe(
      'Twentieth June, Twenty Twenty-Six',
    );
    expect(formatter.formatDateTime('2026-06-20T00:00:00.000Z', 'en')).toBe(
      'Twentieth June, Twenty Twenty-Six',
    );
  });

  it('speaks dates with a time naturally', () => {
    const formatter = new SpeechFormatter();

    expect(formatter.formatDateTime('2026-06-19T09:00:00', 'en')).toBe(
      'Nineteenth June, Twenty Twenty-Six at Nine AM',
    );
    expect(formatter.formatDateTime('2026-06-19T14:30:00', 'en')).toBe(
      'Nineteenth June, Twenty Twenty-Six at Two Thirty PM',
    );
  });

  it('normalizes ISO dates embedded anywhere in a reply', () => {
    const formatter = new SpeechFormatter();
    const text = formatter.sanitizeForSpeech(
      'Here is the task I have:\n- Due date: 2026-06-19T09:00:00',
      'en',
    );

    expect(text).not.toContain('2026-06-19');
    expect(text).toContain('Nineteenth June, Twenty Twenty-Six at Nine AM');
  });

  describe('formatEstimatedTime', () => {
    const formatter = new SpeechFormatter();

    it('formats estimated hours in English correctly', () => {
      expect(formatter.formatEstimatedTime(44.5, 'en')).toBe(
        '1 day, 20 hours, 30 minutes',
      );
      expect(formatter.formatEstimatedTime(39, 'en')).toBe('1 day, 15 hours');
      expect(formatter.formatEstimatedTime(2.25, 'en')).toBe(
        '2 hours, 15 minutes',
      );
      expect(formatter.formatEstimatedTime(0, 'en')).toBe('0 minutes');
      expect(formatter.formatEstimatedTime(24, 'en')).toBe('1 day');
      expect(formatter.formatEstimatedTime(1.5, 'en')).toBe(
        '1 hour, 30 minutes',
      );
    });

    it('formats estimated hours in Serbian correctly with pluralization rules', () => {
      expect(formatter.formatEstimatedTime(44.5, 'sr')).toBe(
        '1 dan, 20 sati, 30 minuta',
      );
      expect(formatter.formatEstimatedTime(39, 'sr')).toBe('1 dan, 15 sati');
      expect(formatter.formatEstimatedTime(2.25, 'sr')).toBe(
        '2 sata, 15 minuta',
      );
      expect(formatter.formatEstimatedTime(0, 'sr')).toBe('0 minuta');
      expect(formatter.formatEstimatedTime(25, 'sr')).toBe('1 dan, 1 sat');
      expect(formatter.formatEstimatedTime(26, 'sr')).toBe('1 dan, 2 sata');
      expect(formatter.formatEstimatedTime(120, 'sr')).toBe('5 dana');
    });
  });
});
