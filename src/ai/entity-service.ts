import { AuthContext } from '../auth/auth.types';
import { env } from '../config/env';
import { DotnetApiClient } from '../integrations/dotnet/dotnet-api.client';
import { vlog } from '../shared/debug';
import {
  EntityQuery,
  EntityRecord,
  EntityType,
  normalizeEntityRecord,
  recordMatches,
} from './entities';

export type EntityServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_configured' | 'failed'; message: string };

export class EntityService {
  constructor(private readonly dotnetApi = new DotnetApiClient()) {}

  async list(
    auth: AuthContext,
    entity: EntityType,
    query: EntityQuery = {},
  ): Promise<EntityServiceResult<EntityRecord[]>> {
    const path = listPath(entity);
    if (!path) return notConfigured(entity, 'list');
    try {
      const payload = await this.dotnetApi.listConfigured(auth.token, path);
      const records = extractRows(payload)
        .map((row) => normalizeEntityRecord(entity, row))
        .filter((record) => recordMatches(record, query))
        .slice(0, query.limit ?? 20);
      vlog('entity', 'list', {
        entity,
        userId: auth.user.id,
        count: records.length,
      });
      return { ok: true, value: records };
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        message: (error as Error).message,
      };
    }
  }

  async count(
    auth: AuthContext,
    entity: EntityType,
    query: EntityQuery = {},
  ): Promise<EntityServiceResult<number>> {
    const result = await this.list(auth, entity, query);
    if (!result.ok) return result;
    return { ok: true, value: result.value.length };
  }

  async getById(
    auth: AuthContext,
    entity: EntityType,
    id: string,
  ): Promise<EntityServiceResult<EntityRecord | undefined>> {
    const path = detailPath(entity);
    if (!path) return notConfigured(entity, 'detail');
    try {
      const payload = await this.dotnetApi.detailConfigured(
        auth.token,
        path,
        id,
      );
      const rows = extractRows(payload);
      const raw =
        rows[0] ??
        (isRecord(payload) && !Array.isArray(payload.data)
          ? payload
          : undefined);
      const record = raw ? normalizeEntityRecord(entity, raw) : undefined;
      vlog('entity', 'detail', {
        entity,
        userId: auth.user.id,
        id,
        found: Boolean(record),
      });
      return { ok: true, value: record };
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        message: (error as Error).message,
      };
    }
  }

  async update(
    auth: AuthContext,
    entity: EntityType,
    id: string,
    patch: Record<string, unknown>,
    existing?: EntityRecord,
  ): Promise<EntityServiceResult<unknown>> {
    const path = updatePath(entity);
    if (!path && entity !== 'worklog') return notConfigured(entity, 'update');
    try {
      const payload = { ...(existing?.raw ?? {}), ...patch, id };
      const value =
        entity === 'task'
          ? await this.dotnetApi.updateTask(auth.token, id, payload)
          : entity === 'note'
            ? await this.dotnetApi.updateNote(auth.token, id, payload)
            : entity === 'event'
              ? await this.dotnetApi.updateEvent(auth.token, id, payload)
              : entity === 'worklog'
                ? await this.dotnetApi.updateWorklog(auth.token, id, payload)
                : await this.dotnetApi.updateConfigured(
                    auth.token,
                    path!,
                    id,
                    payload,
                  );
      vlog('entity', 'update', { entity, userId: auth.user.id, id });
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        message: (error as Error).message,
      };
    }
  }

  async delete(
    auth: AuthContext,
    entity: EntityType,
    id: string,
  ): Promise<EntityServiceResult<unknown>> {
    const path = deletePath(entity);
    if (!path && entity !== 'worklog' && entity !== 'event')
      return notConfigured(entity, 'delete');
    try {
      const value =
        entity === 'task'
          ? await this.dotnetApi.deleteTask(auth.token, id)
          : entity === 'note'
            ? await this.dotnetApi.deleteNote(auth.token, id)
            : entity === 'event'
              ? await this.dotnetApi.deleteEvent(auth.token, id)
              : entity === 'worklog'
                ? await this.dotnetApi.deleteWorklog(auth.token, id)
                : await this.dotnetApi.deleteConfigured(auth.token, path!, id);
      vlog('entity', 'delete', { entity, userId: auth.user.id, id });
      return { ok: true, value };
    } catch (error) {
      return {
        ok: false,
        reason: 'failed',
        message: (error as Error).message,
      };
    }
  }
}

function listPath(entity: EntityType): string | undefined {
  if (entity === 'task') return env.DOTNET_TASKS_LIST_PATH;
  if (entity === 'note') return env.DOTNET_NOTES_LIST_PATH;
  if (entity === 'event') return env.DOTNET_EVENTS_LIST_PATH;
  if (entity === 'worklog') return env.DOTNET_WORKLOGS_LIST_PATH;
  return env.DOTNET_REMINDERS_LIST_PATH;
}

function detailPath(entity: EntityType): string | undefined {
  if (entity === 'task') return env.DOTNET_TASKS_DETAIL_PATH;
  return listPath(entity);
}

function updatePath(entity: EntityType): string | undefined {
  if (entity === 'task') return env.DOTNET_TASKS_UPDATE_PATH;
  if (entity === 'note') return env.DOTNET_NOTES_UPDATE_PATH;
  if (entity === 'event') return env.DOTNET_EVENTS_UPDATE_PATH;
  if (entity === 'worklog') return env.DOTNET_WORKLOGS_UPDATE_PATH;
  return env.DOTNET_REMINDERS_UPDATE_PATH;
}

function deletePath(entity: EntityType): string | undefined {
  if (entity === 'task') return env.DOTNET_TASKS_DELETE_PATH;
  if (entity === 'note') return env.DOTNET_NOTES_DELETE_PATH;
  if (entity === 'event') return env.DOTNET_EVENTS_DELETE_PATH;
  if (entity === 'worklog') return env.DOTNET_WORKLOGS_DELETE_PATH;
  return env.DOTNET_REMINDERS_DELETE_PATH;
}

function notConfigured<T>(
  entity: EntityType,
  operation: string,
): EntityServiceResult<T> {
  return {
    ok: false,
    reason: 'not_configured',
    message: `${operation} endpoint for ${entity} is not configured`,
  };
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ['data', 'items', 'records', 'result', 'results']) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
