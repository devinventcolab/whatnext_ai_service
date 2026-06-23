import { env } from '../../config/env';
import { ApiError } from '../../shared/errors/api-error';
import { AuthUser } from '../../auth/auth.types';
import { vlog } from '../../shared/debug';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const dotnetNameIdentifierClaim =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
type Payload = Record<string, unknown>;

export class DotnetApiClient {
  async getCurrentUser(token: string): Promise<AuthUser> {
    const payload = await this.request<Record<string, unknown>>(
      token,
      'GET',
      env.DOTNET_AUTH_ME_PATH,
    );
    return {
      id: String(
        payload.id ??
          payload.userId ??
          payload.sub ??
          payload.nameid ??
          payload[dotnetNameIdentifierClaim],
      ),
      email: payload.email ? String(payload.email) : undefined,
      name: payload.name
        ? String(payload.name)
        : payload.username
          ? String(payload.username)
          : undefined,
      roles: Array.isArray(payload.roles)
        ? payload.roles.map(String)
        : undefined,
    };
  }

  createTask(token: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_TASKS_PATH,
      toTaskPayload(payload),
    );
  }

  updateTask(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_TASKS_UPDATE_PATH,
      toTaskUpdateFormData(id, payload),
    );
  }

  deleteTask(token: string, id: string) {
    return this.request(
      token,
      'DELETE',
      env.DOTNET_TASKS_DELETE_PATH + '?id=' + encodeURIComponent(id),
    );
  }

  createEvent(token: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_EVENTS_PATH,
      toEventPayload(payload),
    );
  }

  updateEvent(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_EVENTS_UPDATE_PATH,
      toEventPayload({ ...asPayload(payload), id }),
    );
  }

  deleteEvent(token: string, id: string) {
    return this.request(token, 'DELETE', env.DOTNET_EVENTS_PATH + '/' + id);
  }

  createNote(token: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_NOTES_PATH,
      toNotePayload(payload),
    );
  }

  updateNote(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_NOTES_UPDATE_PATH,
      toNotePayload({ ...asPayload(payload), id }),
    );
  }

  deleteNote(token: string, id: string) {
    return this.request(
      token,
      'DELETE',
      env.DOTNET_NOTES_DELETE_PATH + '?id=' + encodeURIComponent(id),
    );
  }

  createWorklog(token: string, payload: unknown) {
    return this.request(
      token,
      'POST',
      env.DOTNET_WORKLOGS_PATH,
      toWorklogFormData(payload),
    );
  }

  updateWorklog(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'PATCH',
      env.DOTNET_WORKLOGS_PATH + '/' + id,
      payload,
    );
  }

  deleteWorklog(token: string, id: string) {
    return this.request(token, 'DELETE', env.DOTNET_WORKLOGS_PATH + '/' + id);
  }

  listConfigured(token: string, path: string) {
    return this.request(token, 'GET', path);
  }

  detailConfigured(token: string, path: string, id: string) {
    return this.request(token, 'GET', addQuery(path, 'id', id));
  }

  updateConfigured(token: string, path: string, id: string, payload: unknown) {
    return this.request(
      token,
      'PATCH',
      path.replace(/\/+$/, '') + '/' + id,
      payload,
    );
  }

  deleteConfigured(token: string, path: string, id: string) {
    return this.request(token, 'DELETE', addQuery(path, 'id', id));
  }

  private async request<T = unknown>(
    token: string,
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    const url = buildApiUrl(path);
    const isFormData =
      typeof FormData !== 'undefined' && body instanceof FormData;

    // Abort the request if the .NET backend does not respond in time, so a
    // slow/unreachable host can never hang the socket handshake or a tool call.
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      env.DOTNET_API_TIMEOUT_MS,
    );

    try {
      vlog('dotnet', 'request', {
        method,
        path,
        formData: isFormData,
        body: previewBody(body),
      });
      response = await fetch(url, {
        method,
        headers: {
          Authorization: 'Bearer ' + token,
          ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        },
        body:
          body === undefined
            ? undefined
            : isFormData
              ? (body as FormData)
              : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ApiError(
        aborted ? 504 : 502,
        aborted
          ? `Timed out contacting .NET backend after ${env.DOTNET_API_TIMEOUT_MS}ms (${url})`
          : 'Could not connect to existing .NET backend',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    const payload = parseResponseBody(text);
    if (!response.ok) {
      const details = sanitizeErrorDetails(payload);
      vlog('dotnet', 'request failed', {
        status: response.status,
        path,
        payload: details,
      });
      throw new ApiError(
        response.status,
        extractErrorMessage(payload) ??
          `Existing backend request failed (${response.status} ${response.statusText || 'Error'})`,
        details,
      );
    }
    if (isFailureEnvelope(payload)) {
      const details = sanitizeErrorDetails(payload);
      vlog('dotnet', 'request success=false', { path, payload: details });
      throw new ApiError(
        502,
        extractErrorMessage(payload) ??
          'Existing backend returned success=false',
        details,
      );
    }
    return payload as T;
  }
}

function parseResponseBody(text: string) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Joins DOTNET_API_BASE_URL and endpoint paths without losing the base path.
 *
 * `new URL('/user/x', 'http://host/api')` becomes `http://host/user/x`, which
 * drops `/api` and returns the MVC 404 HTML page. This helper preserves `/api`.
 */
function buildApiUrl(path: string): string {
  const base = env.DOTNET_API_BASE_URL.replace(/\/+$/, '');
  const endpoint = path.replace(/^\/+/, '');
  return `${base}/${endpoint}`;
}

function addQuery(path: string, key: string, value: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function asPayload(payload: unknown): Payload {
  return payload && typeof payload === 'object' ? (payload as Payload) : {};
}

function str(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  const s = String(value).trim();
  return s || fallback;
}

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toTaskPayload(raw: unknown): Payload {
  const data = asPayload(raw);
  const domain = str(data.domain, 'General');
  const project = str(data.project, domain);
  const startDate = str(data.startDate ?? data.start_date, defaultTodayNine());
  const dueDate = str(data.dueDate ?? data.due_date, new Date().toISOString());

  return {
    title: str(data.title),
    type: str(data.task_type ?? data.type, 'Regular task'),
    profile: str(data.profile, 'Business'),
    project,
    assignee: str(data.assignee),
    domain,
    objective: str(data.objective, str(data.title)),
    isUrgent: toUrgent(data.urgency ?? data.isUrgent),
    description: str(data.description),
    dueDate,
    startDate,
    priority: toTaskPriority(data.priority),
    estimatedTime: toEstimatedHours(data.estimated_time, startDate, dueDate),
  };
}

function toTaskUpdateFormData(id: string, raw: unknown): FormData {
  const data = asPayload(raw);
  const form = new FormData();

  // Contract from .NET curl: POST /api/user/add-task-details as multipart form.
  form.append('TaskTypeID', str(data.TaskTypeID ?? data.task_type_id, '1'));
  form.append('ProfileIds', str(data.ProfileIds ?? data.profile_id, '1'));
  form.append(
    'AssignedUserIds',
    str(data.AssignedUserIds ?? data.assigneeId ?? data.assignee),
  );
  form.append('DomainIds', str(data.DomainIds ?? data.domain_id, '1'));
  form.append('ProjectIds', str(data.ProjectIds ?? data.project_id, '1'));
  form.append('Objectives', str(data.Objectives ?? data.objective));
  form.append('Title', str(data.Title ?? data.title));
  form.append('Priority', str(data.Priority ?? data.priority));
  form.append('Description', str(data.Description ?? data.description));
  form.append('Suggested', str(data.Suggested ?? data.suggested));
  form.append(
    'DeadlineDate',
    str(
      data.DeadlineDate ?? data.dueDate ?? data.deadlineDate,
      new Date().toISOString(),
    ),
  );
  form.append('TaskFile', str(data.TaskFile ?? data.taskFile));
  form.append('IsUrgent', String(toUrgent(data.IsUrgent ?? data.urgency)));
  form.append('ID', str(data.ID ?? data.id, id));

  return form;
}

function toNotePayload(raw: unknown): Payload {
  const data = asPayload(raw);
  const content = str(
    data.content ?? data.notesText ?? data.text ?? data.transcript,
  );
  const payload: Payload = {
    title: str(data.title, 'Untitled'),
    notesText: content,
    hashtag: toHashtagString(content, data.tag),
  };
  const id = str(data.id);
  if (id) payload.id = id;
  if (data.type !== undefined && data.type !== null && data.type !== '') {
    payload.type = noteTypeValue(data.type);
  }
  return payload;
}

function noteTypeValue(value: unknown): number {
  if (typeof value === 'number') return value;
  const text = str(value, 'Reminder');
  const normalized = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  if (normalized === 'Idea') return 0;
  if (normalized === 'Personal') return 2;
  return 1;
}

function toEventPayload(raw: unknown): Payload {
  const data = asPayload(raw);
  const eventName = str(data.eventName ?? data.title);
  const payload: Payload = {
    eventName,
    eventDate: str(
      data.eventDate ?? data.start_time ?? data.date,
      new Date().toISOString(),
    ),
    isPriority: toPriorityFlag(data.isPriority ?? data.priority),
    title: str(data.title ?? data.eventName),
    eventDescription: str(
      data.eventDescription ?? data.description ?? data.event_description,
    ),
    duration: toEventDuration(data.duration, eventName),
    participants: joinList(data.participants),
    reminders: joinList(data.reminders, '10min_before'),
    eventType: num(data.eventType ?? data.event_type, 0),
    eventAddress: str(
      data.eventAddress ?? data.location ?? data.address ?? data.event_address,
    ),
  };
  const id = str(data.ID ?? data.id);
  if (id) payload.ID = id;
  return payload;
}

function toWorklogFormData(raw: unknown): FormData {
  const data = asPayload(raw);
  const form = new FormData();
  form.append('TaskDetailsID', str(data.TaskDetailsID, '1'));
  form.append('ProcessPhaseID', str(data.ProcessPhaseID, '1'));
  form.append('ActivityID', str(data.ActivityID, '1'));
  form.append('CompetenceID', str(data.CompetenceID, '1'));
  form.append('What', str(data.What));
  form.append('How', str(data.How));
  form.append('StartTime', str(data.StartTime, new Date().toISOString()));
  form.append('EndTime', str(data.EndTime, new Date().toISOString()));
  form.append('RealizationTime', str(data.RealizationTime, '0'));
  form.append('Comment', str(data.Comment));
  form.append('TaskName', str(data.TaskName, 'General'));
  if (data.AttachmentPath)
    form.append('AttachmentPath', String(data.AttachmentPath));
  return form;
}

function toTaskPriority(value: unknown): number {
  const p = str(value, 'standard').toLowerCase();
  if (p === 'extreme') return 4;
  if (p === 'high') return 1;
  if (p === 'low') return 3;
  return 2;
}

function toUrgent(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return str(value, 'normal').toLowerCase() === 'urgent';
}

function toPriorityFlag(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value === 0 ? 0 : 1;
  const s = str(value).toLowerCase();
  return ['yes', 'true', '1', 'high', 'urgent'].includes(s) ? 1 : 0;
}

function toEventDuration(value: unknown, eventName: string): number {
  if (value !== undefined && value !== null && value !== '')
    return num(value, 60);
  const defaults: Record<string, number> = {
    Training: 180,
    Workshop: 120,
    Conference: 240,
    Presentation: 90,
    Interview: 45,
    Trip: 120,
  };
  return defaults[eventName] ?? 60;
}

function joinList(value: unknown, fallback = ''): string {
  if (Array.isArray(value))
    return value
      .map((v) => str(v))
      .filter(Boolean)
      .join(',');
  return str(value, fallback)
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(',');
}

function toHashtagString(content: string, manual: unknown): string {
  const fromContent = content.match(/#[a-zA-Z0-9_]+/g) ?? [];
  const fromManual = str(manual)
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  return Array.from(new Set([...fromContent, ...fromManual])).join(',');
}

function defaultTodayNine(): string {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function toEstimatedHours(
  estimated: unknown,
  startDate: string,
  dueDate: string,
): number {
  if (estimated !== undefined && estimated !== null && estimated !== '') {
    return num(estimated, 1);
  }
  const start = new Date(startDate).getTime();
  const due = new Date(dueDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(due) || due <= start)
    return 1;
  const hours = (due - start) / (1000 * 60 * 60);
  return Math.max(0.1, Math.round(hours * 10) / 10);
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const p = payload as Record<string, unknown>;
  const validation = validationErrorsMessage(p.errors);
  if (validation) return validation;
  for (const key of ['message', 'Message', 'error', 'Error', 'title', 'raw']) {
    if (typeof p[key] !== 'string' || !p[key]) continue;
    const value = p[key];
    if (looksLikeHtml(value)) {
      if (value.includes('404') || /page not found/i.test(value)) {
        return 'Existing backend route returned 404 Not Found. Please check the .NET API base URL and endpoint path.';
      }
      return 'Existing backend returned an HTML error page instead of JSON.';
    }
    return value;
  }
  return undefined;
}

function validationErrorsMessage(errors: unknown): string | undefined {
  if (!errors || typeof errors !== 'object') return undefined;
  const parts: string[] = [];
  for (const [field, value] of Object.entries(
    errors as Record<string, unknown>,
  )) {
    if (Array.isArray(value)) {
      const message = value.map(String).join(', ');
      if (message) parts.push(`${field}: ${message}`);
    } else if (typeof value === 'string' && value) {
      parts.push(`${field}: ${value}`);
    }
  }
  return parts.length ? parts.join('; ') : undefined;
}

function looksLikeHtml(value: string): boolean {
  return /<!doctype html|<html[\s>]/i.test(value);
}

function sanitizeErrorDetails(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload;
  const copy: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
  };
  if (typeof copy.raw === 'string' && looksLikeHtml(copy.raw)) {
    copy.raw = '[HTML error page omitted]';
  }
  return copy;
}

function isFailureEnvelope(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === 'object' &&
    (payload as Record<string, unknown>).success === false
  );
}

function previewBody(body: unknown): unknown {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return 'FormData';
  }
  return body;
}
