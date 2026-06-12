import { z } from 'zod';

const confirmed = z.object({ confirmed: z.literal(true) });
const idSchema = z.object({ id: z.string().min(1) }).merge(confirmed);

export const toolSchemas = {
  createTask: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
      dueDate: z.string().optional(),
      reminders: z.array(z.object({ remindAt: z.string() })).optional(),
    })
    .merge(confirmed),
  updateTask: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      status: z.enum(['todo', 'in_progress', 'done', 'cancelled']).optional(),
      dueDate: z.string().optional(),
      reminders: z.array(z.object({ remindAt: z.string() })).optional(),
    })
    .merge(confirmed),
  deleteTask: idSchema,
  createEvent: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      location: z.string().optional(),
      startTime: z.string(),
      endTime: z.string(),
      participants: z.array(z.string()).optional(),
      reminder: z.string().optional(),
    })
    .merge(confirmed),
  updateEvent: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      participants: z.array(z.string()).optional(),
      reminder: z.string().optional(),
    })
    .merge(confirmed),
  deleteEvent: idSchema,
  createNote: z
    .object({
      title: z.string().min(1),
      content: z.string().min(1),
      tags: z.array(z.string()).optional(),
    })
    .merge(confirmed),
  updateNote: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      content: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .merge(confirmed),
  deleteNote: idSchema,
  createWorklog: z
    .object({
      title: z.string().min(1),
      description: z.string().optional(),
      duration: z.number().positive(),
      date: z.string(),
      category: z.string().min(1),
    })
    .merge(confirmed),
  updateWorklog: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      description: z.string().optional(),
      duration: z.number().positive().optional(),
      date: z.string().optional(),
      category: z.string().optional(),
    })
    .merge(confirmed),
  deleteWorklog: idSchema,
};

export type ToolName = keyof typeof toolSchemas;

export const systemPrompt = [
  'You are a productivity-only voice assistant.',
  'Allowed actions: create/update/delete tasks, events, notes, and worklogs.',
  'Ask follow-up questions when required fields are missing.',
  'Before calling any mutation tool, summarize the action and wait for user confirmation.',
  'Set confirmed=true only after the user clearly confirms.',
  'Do not answer unrelated general-purpose questions.',
].join(' ');

export const openAiTools = Object.keys(toolSchemas).map((name) => ({
  type: 'function',
  function: {
    name,
    description: name + ' in the existing .NET productivity backend.',
    parameters: {
      type: 'object',
      additionalProperties: true,
    },
  },
}));
