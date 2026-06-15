import { ToolName } from './productivity-tools';

export type Intent = 'task' | 'note' | 'event' | 'worklog';

export const INTENTS: readonly Intent[] = ['task', 'note', 'event', 'worklog'];

export interface FieldSpec {
  /** Field key sent to the .NET backend (matches the zod tool schemas). */
  name: string;
  /** Human label used in summaries. */
  label: string;
  required: boolean;
  /** Targeted follow-up question asked when this field is missing. */
  question: string;
  type?: 'string' | 'number' | 'array';
  enum?: readonly string[];
}

export interface WorkerSpec {
  intent: Intent;
  /** Singular noun for prompts, e.g. "task". */
  noun: string;
  /** Tool used to create the record. */
  createTool: ToolName;
  fields: FieldSpec[];
}

/**
 * One worker per intent. Required fields mirror the zod schemas in
 * productivity-tools.ts so a completed worker always passes validation.
 */
export const WORKERS: Record<Intent, WorkerSpec> = {
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
        name: 'dueDate',
        label: 'Due date',
        required: false,
        question: 'When is it due?',
      },
      {
        name: 'priority',
        label: 'Priority',
        required: false,
        enum: ['low', 'medium', 'high', 'urgent'],
        question: 'What priority should it be — low, medium, high, or urgent?',
      },
      {
        name: 'description',
        label: 'Description',
        required: false,
        question: 'Any description you want to add?',
      },
    ],
  },
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
        name: 'tags',
        label: 'Tags',
        required: false,
        type: 'array',
        question: 'Any tags to add?',
      },
    ],
  },
  event: {
    intent: 'event',
    noun: 'event',
    createTool: 'createEvent',
    fields: [
      {
        name: 'title',
        label: 'Title',
        required: true,
        question: 'What is the event called?',
      },
      {
        name: 'startTime',
        label: 'Start time',
        required: true,
        question: 'When does it start?',
      },
      {
        name: 'endTime',
        label: 'End time',
        required: true,
        question: 'When does it end?',
      },
      {
        name: 'location',
        label: 'Location',
        required: false,
        question: 'Where is it being held?',
      },
      {
        name: 'description',
        label: 'Description',
        required: false,
        question: 'Any description you want to add?',
      },
    ],
  },
  worklog: {
    intent: 'worklog',
    noun: 'worklog',
    createTool: 'createWorklog',
    fields: [
      {
        name: 'title',
        label: 'Title',
        required: true,
        question: 'What did you work on?',
      },
      {
        name: 'duration',
        label: 'Duration (minutes)',
        required: true,
        type: 'number',
        question: 'How long did it take, in minutes?',
      },
      {
        name: 'date',
        label: 'Date',
        required: true,
        question: 'What date is this for?',
      },
      {
        name: 'category',
        label: 'Category',
        required: true,
        question: 'What category does this fall under?',
      },
      {
        name: 'description',
        label: 'Description',
        required: false,
        question: 'Any description you want to add?',
      },
    ],
  },
};
