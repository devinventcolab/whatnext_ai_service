import { normalizeEntityRecord } from './entities';
import { SpeechFormatter } from './speech-formatter';

describe('speech-friendly formatting', () => {
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
});
