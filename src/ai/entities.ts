import { ToolName } from './productivity-tools';

export type EntityType = 'task' | 'note' | 'event' | 'worklog' | 'reminder';

export const ENTITY_TYPES: readonly EntityType[] = [
  'task',
  'note',
  'event',
  'worklog',
  'reminder',
];

export interface EntityRecord {
  entity: EntityType;
  id: string;
  title: string;
  summary?: string;
  date?: string;
  status?: string;
  priority?: string;
  raw: Record<string, unknown>;
}

export interface EntityQuery {
  text?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  limit?: number;
}

export interface EntitySpec {
  type: EntityType;
  nounKey: string;
  pluralKey: string;
  idFields: string[];
  titleFields: string[];
  summaryFields: string[];
  dateFields: string[];
  statusFields: string[];
  priorityFields: string[];
  updateTool?: ToolName;
}

export const ENTITY_SPECS: Record<EntityType, EntitySpec> = {
  task: {
    type: 'task',
    nounKey: 'noun.task',
    pluralKey: 'noun.tasks',
    idFields: ['id', 'taskId', 'TaskId', 'TaskDetailsID'],
    titleFields: ['title', 'taskName', 'TaskName', 'objective'],
    summaryFields: ['description', 'objective', 'domain', 'project'],
    dateFields: ['dueDate', 'startDate', 'createdAt', 'createdDate'],
    statusFields: ['status', 'Status'],
    priorityFields: ['priority', 'Priority'],
    updateTool: 'updateTask',
  },
  note: {
    type: 'note',
    nounKey: 'noun.note',
    pluralKey: 'noun.notes',
    idFields: ['id', 'noteId', 'NoteId'],
    titleFields: ['title'],
    summaryFields: ['content', 'notesText', 'hashtag', 'tag'],
    dateFields: ['createdAt', 'createdDate', 'created_at'],
    statusFields: ['status'],
    priorityFields: [],
    updateTool: 'updateNote',
  },
  event: {
    type: 'event',
    nounKey: 'noun.event',
    pluralKey: 'noun.events',
    idFields: ['id', 'eventId', 'EventId'],
    titleFields: ['title', 'eventName', 'name'],
    summaryFields: ['description', 'location', 'participants'],
    dateFields: ['eventDate', 'startTime', 'date', 'createdAt'],
    statusFields: ['status'],
    priorityFields: ['priority', 'isPriority'],
    updateTool: 'updateEvent',
  },
  worklog: {
    type: 'worklog',
    nounKey: 'noun.worklog',
    pluralKey: 'noun.worklogs',
    idFields: ['id', 'worklogId', 'WorklogId', 'TaskDetailsID'],
    titleFields: ['What', 'TaskName', 'title'],
    summaryFields: ['How', 'Comment'],
    dateFields: ['StartTime', 'EndTime', 'createdAt'],
    statusFields: ['status'],
    priorityFields: [],
    updateTool: 'updateWorklog',
  },
  reminder: {
    type: 'reminder',
    nounKey: 'noun.reminder',
    pluralKey: 'noun.reminders',
    idFields: ['id', 'reminderId', 'ReminderId'],
    titleFields: ['title', 'name', 'message'],
    summaryFields: ['description', 'message'],
    dateFields: ['remindAt', 'dueDate', 'date'],
    statusFields: ['status'],
    priorityFields: ['priority'],
  },
};

export function isEntityType(value: unknown): value is EntityType {
  return (
    typeof value === 'string' &&
    (ENTITY_TYPES as readonly string[]).includes(value)
  );
}

export function normalizeEntityRecord(
  entity: EntityType,
  raw: Record<string, unknown>,
): EntityRecord {
  const spec = ENTITY_SPECS[entity];
  const id = firstString(raw, spec.idFields) || firstString(raw, ['ID']) || '';
  const title =
    firstString(raw, spec.titleFields) ||
    firstString(raw, spec.summaryFields) ||
    `${entity} ${id || ''}`.trim();
  return {
    entity,
    id,
    title,
    summary: firstString(raw, spec.summaryFields),
    date: firstString(raw, spec.dateFields),
    status: firstString(raw, spec.statusFields),
    priority: firstString(raw, spec.priorityFields),
    raw,
  };
}

export function recordMatches(record: EntityRecord, query: EntityQuery): boolean {
  const text = query.text?.trim().toLowerCase();
  if (text) {
    const haystack = [
      record.id,
      record.title,
      record.summary,
      record.status,
      record.priority,
      JSON.stringify(record.raw),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(text)) return false;
  }
  if (query.status && record.status) {
    if (record.status.toLowerCase() !== query.status.toLowerCase()) return false;
  }
  if (query.dateFrom || query.dateTo) {
    const time = record.date ? new Date(record.date).getTime() : NaN;
    if (Number.isNaN(time)) return false;
    if (query.dateFrom && time < new Date(query.dateFrom).getTime()) return false;
    if (query.dateTo && time > new Date(query.dateTo).getTime()) return false;
  }
  return true;
}

function firstString(
  raw: Record<string, unknown>,
  fields: readonly string[],
): string | undefined {
  for (const field of fields) {
    const value = raw[field];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
}
