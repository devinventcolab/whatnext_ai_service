import { ToolName } from './productivity-tools';

export type Intent = 'task' | 'note' | 'event' | 'worklog';

export const INTENTS: readonly Intent[] = ['task', 'note', 'event', 'worklog'];

/** Default values are resolved at fill-time so dates/user are accurate. */
export interface DefaultContext {
  now: Date;
  userId: string;
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
  assignee: 'Me',
  task_type: 'Regular task',
  profile: 'Business',
  domain: 'General',
  project: 'WhatNext app',
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
        required: true,
        enum: ['low', 'standard', 'high', 'extreme'],
        default: () => 'standard',
      },
      {
        name: 'urgency',
        required: false,
        enum: ['normal', 'urgent'],
        default: () => 'normal',
      },
      { name: 'task_type', required: false, default: () => TASK_DEFAULTS.task_type },
      { name: 'profile', required: false, default: () => TASK_DEFAULTS.profile },
      {
        name: 'estimated_time',
        required: true,
        type: 'number',
        default: () => 1,
      },
      { name: 'assignee', required: true, default: () => TASK_DEFAULTS.assignee },
      {
        name: 'startDate',
        required: false,
        default: ({ now }) => isoLocal(atNine(now, 0)),
      },
      {
        name: 'dueDate',
        required: true,
        default: ({ now }) => isoLocal(atNine(now, 1)),
      },
      { name: 'domain', required: false, default: () => TASK_DEFAULTS.domain },
      { name: 'project', required: false, default: () => TASK_DEFAULTS.project },
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
      },
      { name: 'created_by', required: false },
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
      { name: 'eventDate', required: true },
      { name: 'duration', required: true, type: 'number', default: () => 60 },
      { name: 'participants', required: false, type: 'array' },
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
      { name: 'How', required: false },
      { name: 'TaskName', required: false },
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

/** Returns `now` shifted by `addDays` days, set to 09:00:00. */
function atNine(now: Date, addDays: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + addDays);
  d.setHours(9, 0, 0, 0);
  return d;
}
