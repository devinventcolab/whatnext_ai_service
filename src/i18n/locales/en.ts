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
  'msg.confirmCreate': 'Should I create this {noun}?',
  'msg.created': 'Done. I’ve created the {noun}.',
  'msg.createFailed':
    'I couldn’t create the {noun}: {error}. Want to try again or change something?',

  // ---- intent nouns ----
  'noun.task': 'task',
  'noun.note': 'note',
  'noun.event': 'event',
  'noun.worklog': 'worklog',

  // ---- HTTP / API errors ----
  'error.validation': 'Validation failed',
  'error.internal': 'Internal server error',

  // ---- task fields ----
  'field.task.title.label': 'Title',
  'field.task.title.question': 'What should the task be called?',
  'field.task.priority.label': 'Priority',
  'field.task.priority.question':
    'What priority — low, standard, high, or extreme?',
  'field.task.urgency.label': 'Urgency',
  'field.task.urgency.question': 'Is it normal or urgent?',
  'field.task.task_type.label': 'Task type',
  'field.task.task_type.question': 'What type of task is it?',
  'field.task.profile.label': 'Profile',
  'field.task.profile.question': 'Which profile is this for?',
  'field.task.estimated_time.label': 'Estimated time (hours)',
  'field.task.estimated_time.question':
    'How many hours do you estimate it will take?',
  'field.task.assignee.label': 'Assignee',
  'field.task.assignee.question': 'Who is responsible for it?',
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
  'field.event.eventName.label': 'Event type',
  'field.event.eventName.question':
    'What type of event is it — a meeting, training, workshop, conference, and so on?',
  'field.event.eventDate.label': 'Date & time',
  'field.event.eventDate.question': 'When is it scheduled for?',
  'field.event.duration.label': 'Duration (minutes)',
  'field.event.duration.question': 'How long will it run, in minutes?',
  'field.event.participants.label': 'Participants',
  'field.event.participants.question': 'Who should be invited?',
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
