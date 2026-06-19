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
});
