import { z } from 'zod';

/**
 * Tool schemas. Field keys, enums, and required sets are taken from the main
 * WhatNext app's canonical tool definitions (src/utils/tools.ts) so the
 * payloads we send match exactly what the .NET backend expects:
 *   create_task, create_note, schedule_meeting (event), log_work (worklog).
 */

const confirmed = z.object({ confirmed: z.literal(true) });
const idSchema = z.object({ id: z.string().min(1) }).merge(confirmed);

const taskPriority = z.enum(['low', 'standard', 'high', 'extreme']);
const taskUrgency = z.enum(['normal', 'urgent']);
const noteType = z.enum(['Idea', 'Reminder', 'Personal']);
const eventName = z.enum([
  'Meeting',
  'Kick-off',
  'Training',
  'Workshop',
  'Conference',
  'Presentation',
  'Interview',
  'Trip',
]);

export const toolSchemas = {
  // create_task
  createTask: z
    .object({
      title: z.string().min(1),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
      startDate: z.string().optional(),
      priority: taskPriority.optional(),
      urgency: taskUrgency.optional(),
      description: z.string().optional(),
      task_type: z.string().optional(),
      profile: z.string().optional(),
      domain: z.string().optional(),
      objective: z.string().optional(),
      estimated_time: z.number().optional(),
      project: z.string().optional(),
    })
    .merge(confirmed),
  updateTask: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      assignee: z.string().optional(),
      dueDate: z.string().optional(),
      startDate: z.string().optional(),
      priority: taskPriority.optional(),
      urgency: taskUrgency.optional(),
      description: z.string().optional(),
      task_type: z.string().optional(),
      profile: z.string().optional(),
      domain: z.string().optional(),
      objective: z.string().optional(),
      estimated_time: z.number().optional(),
      project: z.string().optional(),
    })
    .merge(confirmed),
  deleteTask: idSchema,

  // schedule_meeting (event)
  createEvent: z
    .object({
      eventName,
      title: z.string().optional(),
      eventDate: z.string(),
      duration: z.number().int().positive(),
      participants: z.array(z.string()).optional(),
      isPriority: z.union([z.boolean(), z.number(), z.string()]).optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      reminders: z.array(z.string()).optional(),
    })
    .merge(confirmed),
  updateEvent: z
    .object({
      id: z.string().min(1),
      eventName: eventName.optional(),
      title: z.string().optional(),
      eventDate: z.string().optional(),
      duration: z.number().int().positive().optional(),
      participants: z.array(z.string()).optional(),
      isPriority: z.union([z.boolean(), z.number(), z.string()]).optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      reminders: z.array(z.string()).optional(),
    })
    .merge(confirmed),
  deleteEvent: idSchema,

  // create_note
  createNote: z
    .object({
      title: z.string().min(1),
      content: z.string().min(1),
      tag: z.string().optional(),
      type: noteType.optional(),
      created_at: z.string().optional(),
      created_by: z.string().optional(),
    })
    .merge(confirmed),
  updateNote: z
    .object({
      id: z.string().min(1),
      title: z.string().optional(),
      content: z.string().optional(),
      tag: z.string().optional(),
      type: noteType.optional(),
    })
    .merge(confirmed),
  deleteNote: idSchema,

  // log_work (worklog)
  createWorklog: z
    .object({
      What: z.string().min(1),
      How: z.string().optional(),
      StartTime: z.string(),
      EndTime: z.string(),
      RealizationTime: z.number().int().optional(),
      Comment: z.string().optional(),
      TaskName: z.string().optional(),
      TaskDetailsID: z.number().int().optional(),
      ProcessPhaseID: z.number().int().optional(),
      ActivityID: z.number().int().optional(),
      CompetenceID: z.number().int().optional(),
    })
    .merge(confirmed),
  updateWorklog: z
    .object({
      id: z.string().min(1),
      What: z.string().optional(),
      How: z.string().optional(),
      StartTime: z.string().optional(),
      EndTime: z.string().optional(),
      RealizationTime: z.number().int().optional(),
      Comment: z.string().optional(),
      TaskName: z.string().optional(),
    })
    .merge(confirmed),
  deleteWorklog: idSchema,
};

export type ToolName = keyof typeof toolSchemas;
