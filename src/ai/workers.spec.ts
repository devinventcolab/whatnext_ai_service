import { WORKERS, normalizeReminder } from './workers';

describe('task worker defaults', () => {
  const estimatedTimeField = WORKERS.task.fields.find(
    (field) => field.name === 'estimated_time',
  );

  it('derives estimated_time from TASK_DEFAULTS when the user did not provide it', () => {
    const value = estimatedTimeField?.default?.({
      now: new Date('2026-06-23T08:00:00'),
      userId: 'user-1',
      fields: {
        dueDate: '2026-06-24T09:00:00',
      },
    });

    expect(value).toBe(1);
  });

  it('uses the provided startDate when calculating estimated_time', () => {
    const value = estimatedTimeField?.default?.({
      now: new Date('2026-06-23T08:00:00'),
      userId: 'user-1',
      fields: {
        startDate: '2026-06-23T10:00:00',
        dueDate: '2026-06-23T12:30:00',
      },
    });

    expect(value).toBe(1);
  });

  it('does not force a fallback value of 1 when dueDate is missing', () => {
    const value = estimatedTimeField?.default?.({
      now: new Date('2026-06-23T08:00:00'),
      userId: 'user-1',
      fields: {},
    });

    expect(value).toBe(1);
  });
});

describe('normalizeReminder', () => {
  it('keeps already canonical values', () => {
    expect(normalizeReminder('10min_before')).toBe('10min_before');
    expect(normalizeReminder('1hour_before')).toBe('1hour_before');
  });

  it('normalizes english variants to canonical minutes/hours before format', () => {
    expect(normalizeReminder('20mint')).toBe('20min_before');
    expect(normalizeReminder('25mint')).toBe('25min_before');
    expect(normalizeReminder('30 min')).toBe('30min_before');
    expect(normalizeReminder('15 minutes before')).toBe('15min_before');
    expect(normalizeReminder('1 hour')).toBe('1hour_before');
    expect(normalizeReminder('2h')).toBe('2hour_before');
  });

  it('normalizes serbian variants to canonical minutes/hours before format', () => {
    expect(normalizeReminder('20 minuta pre')).toBe('20min_before');
    expect(normalizeReminder('1 sat pre')).toBe('1hour_before');
    expect(normalizeReminder('2 sata')).toBe('2hour_before');
    expect(normalizeReminder('15 min')).toBe('15min_before');
  });
});
