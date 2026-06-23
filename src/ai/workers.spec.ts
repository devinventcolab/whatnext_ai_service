import { WORKERS } from './workers';

describe('task worker defaults', () => {
  const estimatedTimeField = WORKERS.task.fields.find(
    (field) => field.name === 'estimated_time',
  );

  it('derives estimated_time from dueDate when the user did not provide it', () => {
    const value = estimatedTimeField?.default?.({
      now: new Date('2026-06-23T08:00:00'),
      userId: 'user-1',
      fields: {
        dueDate: '2026-06-24T09:00:00',
      },
    });

    expect(value).toBe(24);
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

    expect(value).toBe(2.5);
  });

  it('does not force a fallback value of 1 when dueDate is missing', () => {
    const value = estimatedTimeField?.default?.({
      now: new Date('2026-06-23T08:00:00'),
      userId: 'user-1',
      fields: {},
    });

    expect(value).toBeUndefined();
  });
});
