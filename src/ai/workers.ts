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
   */
  name: string;
  /** Human label used in confirmation summaries. */
  label: string;
  /** Must be present (or defaulted) before the record can be created. */
  required: boolean;
  /** Targeted follow-up asked when a required field has no value and no default. */
  question: string;
  type?: 'string' | 'number' | 'array';
  enum?: readonly string[];
  /**
   * Auto-fill used when the field is missing. Fields with a default are never
   * asked about — they are populated silently and shown in the summary so the
   * user can still change them before confirming.
   */
  default?: (ctx: DefaultContext) => unknown;
}

export interface WorkerSpec {
  intent: Intent;
  noun: string;
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
 * One worker per intent. Required fields with a `default` are auto-filled
 * (matching the canonical app's default behavior); only required fields
 * WITHOUT a default trigger a follow-up question.
 */
export const WORKERS: Record<Intent, WorkerSpec> = {
  // create_task
  task: {
    intent: 'task',
    noun: 'task',
    createTool: 'createTask',
    fields: [
      {
        name: 'title',
        label: 'Title',
        required: true,
        question: 'What should the task be called?',
      },
      {
        name: 'priority',
        label: 'Priority',
        required: true,
        enum: ['low', 'standard', 'high', 'extreme'],
        question: 'What priority — low, standard, high, or extreme?',
        default: () => 'standard',
      },
      {
        name: 'urgency',
        label: 'Urgency',
        required: true,
        enum: ['normal', 'urgent'],
        question: 'Is it normal or urgent?',
        default: () => 'normal',
      },
      {
        name: 'task_type',
        label: 'Task type',
        required: true,
        question: 'What type of task is it?',
        default: () => TASK_DEFAULTS.task_type,
      },
      {
        name: 'profile',
        label: 'Profile',
        required: true,
        question: 'Which profile is this for?',
        default: () => TASK_DEFAULTS.profile,
      },
      {
        name: 'estimated_time',
        label: 'Estimated time (hours)',
        required: true,
        type: 'number',
        question: 'How many hours do you estimate it will take?',
        default: () => 1,
      },
      {
        name: 'assignee',
        label: 'Assignee',
        required: false,
        question: 'Who is responsible for it?',
        default: () => TASK_DEFAULTS.assignee,
      },
      {
        name: 'startDate',
        label: 'Start date',
        required: false,
        question: 'When should it start?',
        default: ({ now }) => isoLocal(atNine(now, 0)),
      },
      {
        name: 'dueDate',
        label: 'Due date',
        required: false,
        question: 'When is it due?',
        default: ({ now }) => isoLocal(atNine(now, 1)),
      },
      {
        name: 'domain',
        label: 'Domain',
        required: false,
        question: 'Which work domain?',
        default: () => TASK_DEFAULTS.domain,
      },
      {
        name: 'project',
        label: 'Project',
        required: false,
        question: 'Which project?',
        default: () => TASK_DEFAULTS.project,
      },
      {
        name: 'objective',
        label: 'Objective',
        required: false,
        question: 'What is the objective?',
      },
      {
        name: 'description',
        label: 'Description',
        required: false,
        question: 'Any description to add?',
      },
    ],
  },

  // create_note
  note: {
    intent: 'note',
    noun: 'note',
    createTool: 'createNote',
    fields: [
      {
        name: 'title',
        label: 'Title',
        required: true,
        question: 'What should the note be titled?',
      },
      {
        name: 'content',
        label: 'Content',
        required: true,
        question: 'What should the note say?',
      },
      {
        name: 'type',
        label: 'Type',
        required: true,
        enum: ['Idea', 'Reminder', 'Personal'],
        question: 'Is it an Idea, Reminder, or Personal note?',
        default: () => 'Reminder',
      },
      {
        name: 'tag',
        label: 'Tags',
        required: true,
        question: 'Any tags to add?',
        default: () => 'General',
      },
      {
        name: 'created_at',
        label: 'Created at',
        required: true,
        question: 'When was it created?',
        default: ({ now }) => now.toISOString(),
      },
      {
        name: 'created_by',
        label: 'Created by',
        required: true,
        question: 'Who created it?',
        default: ({ userId }) => userId,
      },
    ],
  },

  // schedule_meeting
  event: {
    intent: 'event',
    noun: 'event',
    createTool: 'createEvent',
    fields: [
      {
        name: 'eventName',
        label: 'Event type',
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
        question:
          'What type of event is it — a meeting, training, workshop, conference, and so on?',
      },
      {
        name: 'eventDate',
        label: 'Date & time',
        required: true,
        question: 'When is it scheduled for?',
      },
      {
        name: 'duration',
        label: 'Duration (minutes)',
        required: true,
        type: 'number',
        question: 'How long will it run, in minutes?',
        default: () => 60,
      },
      {
        name: 'participants',
        label: 'Participants',
        required: false,
        type: 'array',
        question: 'Who should be invited?',
      },
      {
        name: 'location',
        label: 'Location',
        required: false,
        question: 'Where is it being held?',
      },
      {
        name: 'reminders',
        label: 'Reminders',
        required: false,
        type: 'array',
        question: 'When should I remind you?',
        default: () => ['10min_before'],
      },
      {
        name: 'description',
        label: 'Description',
        required: false,
        question: 'Any description to add?',
      },
    ],
  },

  // log_work
  worklog: {
    intent: 'worklog',
    noun: 'worklog',
    createTool: 'createWorklog',
    fields: [
      {
        name: 'What',
        label: 'Work done',
        required: true,
        question: 'What did you work on?',
      },
      {
        name: 'StartTime',
        label: 'Start time',
        required: true,
        question: 'When did you start?',
      },
      {
        name: 'EndTime',
        label: 'End time',
        required: true,
        question: 'When did you finish?',
      },
      {
        name: 'How',
        label: 'How',
        required: false,
        question: 'How did you do it?',
      },
      {
        name: 'TaskName',
        label: 'Task',
        required: false,
        question: 'Which task does this relate to?',
      },
      {
        name: 'Comment',
        label: 'Comment',
        required: false,
        question: 'Any additional comments?',
      },
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
