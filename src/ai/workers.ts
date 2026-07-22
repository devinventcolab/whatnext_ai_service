import { ToolName } from './productivity-tools';

export type Intent = 'task' | 'note' | 'event' | 'worklog';

export const INTENTS: readonly Intent[] = ['task', 'note', 'event', 'worklog'];

/** Default values are resolved at fill-time so dates/user are accurate. */
export interface DefaultContext {
  now: Date;
  userId: string;
  userName?: string;
  fields: Record<string, unknown>;
}

export interface FieldSpec {
  /**
   * Field key sent to the .NET backend. Keys mirror the main app's canonical
   * tool schemas (src/utils/tools.ts).
   *
   * User-facing label and follow-up question are NOT stored here — they are
   * resolved from i18n using `field.<intent>.<name>.label` and
   * `field.<intent>.<name>.question`, so no display text is hardcoded.
   */
  name: string;
  /** Must be present (or defaulted) before the record can be created. */
  required: boolean;
  type?: 'string' | 'number' | 'array';
  enum?: readonly string[];
  /**
   * Auto-fill used when an OPTIONAL field is missing. Required fields are never
   * defaulted by the conversation manager; they must be explicitly collected
   * from the user before confirmation.
   */
  default?: (ctx: DefaultContext) => unknown;
}

export interface WorkerSpec {
  intent: Intent;
  createTool: ToolName;
  fields: FieldSpec[];
}

const TASK_DEFAULTS = {
  task_type: 'Regular task',
  profile: 'Business',
  domain: 'General',
  project: 'WhatNext app',
  estimated_time: 1,
  assignee: (ctx: DefaultContext) => ctx.userName || ctx.userId,
};

/**
 * One worker per intent. Required fields are always collected from the user.
 * Defaults are used only for optional backend convenience fields.
 */
export const WORKERS: Record<Intent, WorkerSpec> = {
  // create_task
  task: {
    intent: 'task',
    createTool: 'createTask',
    fields: [
      { name: 'title', required: true },
      {
        name: 'priority',
        required: false,
        enum: ['low', 'standard', 'high', 'extreme'],
        default: () => 'standard',
      },
      {
        name: 'urgency',
        required: false,
        enum: ['normal', 'urgent'],
        default: () => 'normal',
      },
      {
        name: 'task_type',
        required: false,
        default: () => TASK_DEFAULTS.task_type,
      },
      {
        name: 'profile',
        required: false,
        default: () => TASK_DEFAULTS.profile,
      },
      {
        name: 'estimated_time',
        required: false,
        type: 'number',
        default: () => TASK_DEFAULTS.estimated_time,
        // default: ({ now, fields }) =>
        //   estimateTaskHours(
        //     fields.startDate,
        //     fields.dueDate,
        //     isoLocal(atNine(now, 0)),
        //   ),
      },
      {
        name: 'assignee',
        required: false,
        default: (ctx) => TASK_DEFAULTS.assignee(ctx),
      },
      {
        name: 'startDate',
        required: false,
        default: ({ now }) => dateOnlyLocal(now),
      },
      {
        name: 'dueDate',
        required: true,
        //default: ({ now }) => isoLocal(atNine(now, 1)),
      },
      { name: 'domain', required: false, default: () => TASK_DEFAULTS.domain },
      {
        name: 'project',
        required: false,
        default: () => TASK_DEFAULTS.project,
      },
      { name: 'objective', required: false },
      { name: 'description', required: false },
    ],
  },

  // create_note
  note: {
    intent: 'note',
    createTool: 'createNote',
    fields: [
      { name: 'title', required: true },
      { name: 'content', required: true },
      {
        name: 'type',
        required: false,
        enum: ['Idea', 'Reminder', 'Personal'],
      },
      { name: 'tag', required: false },
      {
        name: 'created_at',
        required: false,
        default: ({ now }) => isoLocal(now),
      },
      {
        name: 'created_by',
        required: false,
        default: (ctx) => ctx.userName || ctx.userId,
      },
    ],
  },

  // schedule_meeting
  event: {
    intent: 'event',
    createTool: 'createEvent',
    fields: [
      {
        name: 'eventName',
        required: true,
        enum: [
          'Meeting',
          'Kick-off',
          'Training',
          'Workshop',
          'Conference',
          'Presentation',
          'Interview',
          'Trip',
        ],
      },
      { name: 'title', required: true },
      { name: 'eventDate', required: true },
      { name: 'duration', required: true, type: 'number', default: () => 60 },
      { name: 'participants', required: true, type: 'array' },
      { name: 'isPriority', required: false },
      { name: 'location', required: false },
      {
        name: 'reminders',
        required: false,
        type: 'array',
        default: () => ['10min_before'],
      },
      { name: 'description', required: false },
    ],
  },

  // log_work
  worklog: {
    intent: 'worklog',
    createTool: 'createWorklog',
    fields: [
      { name: 'What', required: true },
      { name: 'StartTime', required: true },
      { name: 'EndTime', required: true },
      { name: 'How', required: true },
      { name: 'RealizationTime', required: false, default: () => '10' },
      { name: "Activities", required: false },
      { name: "processPhases", required: false },
      { name: "competences", required: false },
      { name: 'taskId', required: false },
      { name: 'Comment', required: false },
    ],
  },
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a Date as local `YYYY-MM-DDTHH:mm:ss` (matches the app's UTC-naive format). */
function isoLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** Formats a Date as local `YYYY-MM-DD`. */
function dateOnlyLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Returns `now` shifted by `addDays` days, set to 09:00:00. */
function atNine(now: Date, addDays: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + addDays);
  d.setHours(9, 0, 0, 0);
  return d;
}

function estimateTaskHours(
  startDate: unknown,
  dueDate: unknown,
  fallbackStartDate: string,
): number | undefined {
  const start = new Date(String(startDate ?? fallbackStartDate)).getTime();
  const due = new Date(String(dueDate ?? '')).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start) {
    return undefined;
  }
  const hours = (due - start) / (1000 * 60 * 60);
  return Math.max(0.1, Math.round(hours * 10) / 10);
}

export function normalizeReminder(val: string): string {
  const clean = val.trim().toLowerCase();

  // If already canonical (e.g. 10min_before or 1hour_before), return
  if (/^\d+(?:min|hour)_before$/.test(clean)) {
    return clean;
  }

  // Strip common prepositional words to simplify parsing
  const stripped = clean
    .replace(/\b(before|pre|za|u|at|o|about)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Parse minutes: "20mint", "20min", "20 min", "20 minuta", "20m"
  const minMatch = stripped.match(
    /^(\d+)\s*(?:mint|min|mins|minute|minutes|m|minut|minuta|minute)?$/,
  );
  if (minMatch) {
    return `${minMatch[1]}min_before`;
  }

  // Parse hours: "1 hour", "1h", "1 sat", "2 sata"
  const hourMatch = stripped.match(/^(\d+)\s*(?:hour|hours|h|sat|sata|sati)?$/);
  if (hourMatch) {
    return `${hourMatch[1]}hour_before`;
  }

  if (/^\d+$/.test(stripped)) {
    return `${stripped}min_before`;
  }

  return val;
}
