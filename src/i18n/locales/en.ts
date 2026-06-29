import { TranslationTable } from '../types';

/** English (default) translations. Keys are dotted; {var} marks an interpolation. */
const en: TranslationTable = {
  // ---- conversation messages (spoken to the user) ----
  'msg.cantHear': 'Sorry, I didn’t catch that. Could you repeat?',
  'msg.noApiKey':
    'The assistant is not fully configured yet, so I can’t process requests.',
  'msg.nluError': 'I had trouble understanding that. Could you say it again?',
  'msg.cancelled':
    'Okay, I’ve cancelled that {noun}. What would you like to do next?',
  'msg.cancelledNone': 'Okay. What would you like to do?',
  'msg.chooseIntent':
    'I can help you create a task, note, event, or worklog. Which would you like to do?',
  'msg.ack': 'Got it. ',
  'msg.great': 'Great.',
  'msg.updated': 'Updated.',
  'msg.summaryHeader': 'Here’s the {noun} I have:',
  'msg.confirmCreate':
    'Should I create this {noun}, or would you like to change any field first? Say "create" to confirm, or tell me which field to update.',
  'msg.created': 'Done. I’ve created the {noun}.',
  'msg.createFailed':
    'I couldn’t create the {noun}: {error}. Want to try again or change something?',
  'msg.invalidEnum':
    '{field} must be one of these values only: {values}. Please choose one of them.',
  'msg.notSet': 'Not set',
  'msg.closing':
    'You’re welcome! Have a great day. Just say the word whenever you need me again.',

  // ---- intent nouns ----
  'noun.task': 'task',
  'noun.tasks': 'tasks',
  'noun.note': 'note',
  'noun.notes': 'notes',
  'noun.event': 'event',
  'noun.events': 'events',
  'noun.worklog': 'worklog',
  'noun.worklogs': 'worklogs',
  'noun.reminder': 'reminder',
  'noun.reminders': 'reminders',

  // ---- query / update workers ----
  'query.countHeader': 'Here is what I found:',
  'query.countLine': '- {count} {entity}',
  'query.listHeader': 'I found {count} {entity}:',
  'query.moreResults': 'There are {count} more.',
  'query.noResults': 'I could not find any {entity}.',
  'query.noneConfigured':
    'No retrieval endpoints are configured yet. I can still help create records.',
  'query.notConfigured':
    '{entity} retrieval is not connected yet. Please provide the endpoint when it is available.',
  'query.failed': 'I could not retrieve {entity}: {error}',
  'update.whichEntity': 'What would you like to update?',
  'update.cancelled': 'Okay, I cancelled the update.',
  'update.noMatches': 'I could not find matching {entity}.',
  'update.multipleMatches': 'I found multiple matching {entity}:',
  'update.selectPrompt': 'Which one should I update?',
  'update.selectionNotFound':
    'I could not match that selection. Please choose by number or name.',
  'update.whatChange': 'What would you like to change for {record}?',
  'update.summaryHeader': 'Here are the changes for {record}:',
  'update.confirm': 'Should I update this {entity}?',
  'update.updated': 'Done. I updated the {entity}.',
  'update.notConfigured':
    '{entity} updates are not connected yet. Please provide the endpoint when it is available.',
  'update.failed': 'I could not update it: {error}',
  'update.nothingToConfirm': 'There is no update ready to confirm yet.',
  'update.missingId':
    'I found the record, but it does not include an ID I can update.',
  'delete.whichEntity': 'What would you like to delete?',
  'delete.cancelled': 'Okay, I cancelled the delete request.',
  'delete.noMatches': 'I could not find matching {entity}.',
  'delete.multipleMatches': 'I found multiple matching {entity}:',
  'delete.selectPrompt': 'Which one should I delete?',
  'delete.selectionNotFound':
    'I could not match that selection. Please choose by number or name.',
  'delete.confirm': 'Should I delete {record}?',
  'delete.deleted': 'Done. I deleted the {entity}.',
  'delete.notConfigured':
    '{entity} deletion is not connected yet. Please provide the endpoint when it is available.',
  'delete.failed': 'I could not delete it: {error}',
  'delete.nothingToConfirm': 'There is no delete request ready to confirm yet.',
  'delete.missingId':
    'I found the record, but it does not include an ID I can delete.',
  'date.today': 'today',
  'date.tomorrow': 'tomorrow',
  'date.todayAt': 'today at {time}',
  'date.tomorrowAt': 'tomorrow at {time}',
  'date.dateAtTime': '{date} at {time}',
  'duration.minutes': '{count} minutes',
  'duration.hours': '{count} hours',
  'duration.hoursMinutes': '{hours} hours and {minutes} minutes',
  'speech.hiddenId': 'internal ID hidden',
  'enum.low': 'low',
  'enum.standard': 'standard',
  'enum.high': 'high',
  'enum.extreme': 'extreme',
  'enum.normal': 'normal',
  'enum.urgent': 'urgent',
  'enum.todo': 'to do',
  'enum.in_progress': 'in progress',
  'enum.done': 'done',
  'enum.cancelled': 'cancelled',
  'enum.idea': 'Idea',
  'enum.reminder': 'Reminder',
  'enum.personal': 'Personal',
  'enum.meeting': 'Meeting',
  'enum.kick-off': 'Kick-off',
  'enum.training': 'Training',
  'enum.workshop': 'Workshop',
  'enum.conference': 'Conference',
  'enum.presentation': 'Presentation',
  'enum.interview': 'Interview',
  'enum.trip': 'Trip',

  // ---- HTTP / API errors ----
  'error.validation': 'Validation failed',
  'error.internal': 'Internal server error',

  // ---- task fields ----
  'field.task.title.label': 'Title',
  'field.task.title.question': 'What should the task title be?',
  'field.task.priority.label': 'Priority',
  'field.task.priority.question':
    'What priority — low, standard, high, or extreme?',
  'field.task.urgency.label': 'Urgency',
  'field.task.urgency.question': 'Is it normal or urgent?',
  'field.task.task_type.label': 'Task type',
  'field.task.task_type.question': 'What type of task is it?',
  'field.task.profile.label': 'Profile',
  'field.task.profile.question': 'Which profile is this for?',
  'field.task.estimated_time.label': 'Estimated time',
  'field.task.estimated_time.question':
    'How many hours do you estimate it will take?',
  'field.task.assignee.label': 'Assignee',
  'field.task.assignee.question': 'Who is assigned to it?',
  'field.task.startDate.label': 'Start date',
  'field.task.startDate.question': 'When should it start?',
  'field.task.dueDate.label': 'Due date',
  'field.task.dueDate.question': 'When is it due?',
  'field.task.domain.label': 'Domain',
  'field.task.domain.question': 'Which work domain?',
  'field.task.project.label': 'Project',
  'field.task.project.question': 'Which project?',
  'field.task.objective.label': 'Objective',
  'field.task.objective.question': 'What is the objective?',
  'field.task.description.label': 'Description',
  'field.task.description.question': 'Any description to add?',

  // ---- note fields ----
  'field.note.title.label': 'Title',
  'field.note.title.question': 'What should the note be titled?',
  'field.note.content.label': 'Content',
  'field.note.content.question': 'What should the note say?',
  'field.note.type.label': 'Type',
  'field.note.type.question': 'Is it an Idea, Reminder, or Personal note?',
  'field.note.tag.label': 'Tags',
  'field.note.tag.question': 'Any tags to add?',
  'field.note.created_at.label': 'Created at',
  'field.note.created_at.question': 'When was it created?',
  'field.note.created_by.label': 'Created by',
  'field.note.created_by.question': 'Who created it?',

  // ---- event fields ----
  'field.event.title.label': 'Title',
  'field.event.title.question': 'What should the event title be?',
  'field.event.eventName.label': 'Event type',
  'field.event.eventName.question':
    'What type of event is it? Please choose one of: Meeting, Kick-off, Training, Workshop, Conference, Presentation, Interview, or Trip.',
  'field.event.eventDate.label': 'Date & time',
  'field.event.eventDate.question': 'When is it scheduled for?',
  'field.event.duration.label': 'Duration (minutes)',
  'field.event.duration.question': 'How long will it run, in minutes?',
  'field.event.participants.label': 'Participants',
  'field.event.participants.question': 'Who should be invited?',
  'field.event.isPriority.label': 'Priority flag',
  'field.event.isPriority.question': 'Should this event be marked as priority?',
  'field.event.location.label': 'Location',
  'field.event.location.question': 'Where is it being held?',
  'field.event.reminders.label': 'Reminders',
  'field.event.reminders.question': 'When should I remind you?',
  'field.event.description.label': 'Description',
  'field.event.description.question': 'Any description to add?',

  // ---- worklog fields ----
  'field.worklog.What.label': 'Work done',
  'field.worklog.What.question': 'What did you work on?',
  'field.worklog.StartTime.label': 'Start time',
  'field.worklog.StartTime.question': 'When did you start?',
  'field.worklog.EndTime.label': 'End time',
  'field.worklog.EndTime.question': 'When did you finish?',
  'field.worklog.How.label': 'How',
  'field.worklog.How.question': 'How did you do it?',
  'field.worklog.TaskName.label': 'Task',
  'field.worklog.TaskName.question': 'Which task does this relate to?',
  'field.worklog.Comment.label': 'Comment',
  'field.worklog.Comment.question': 'Any additional comments?',
};

export default en;
