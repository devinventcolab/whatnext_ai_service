import { env } from '../../config/env';
import { ApiError } from '../../shared/errors/api-error';
import { AuthUser } from '../../auth/auth.types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';
const dotnetNameIdentifierClaim =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';

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
    return this.request(token, 'POST', env.DOTNET_TASKS_PATH, payload);
  }

  updateTask(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'PATCH',
      env.DOTNET_TASKS_PATH + '/' + id,
      payload,
    );
  }

  deleteTask(token: string, id: string) {
    return this.request(token, 'DELETE', env.DOTNET_TASKS_PATH + '/' + id);
  }

  createEvent(token: string, payload: unknown) {
    return this.request(token, 'POST', env.DOTNET_EVENTS_PATH, payload);
  }

  updateEvent(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'PATCH',
      env.DOTNET_EVENTS_PATH + '/' + id,
      payload,
    );
  }

  deleteEvent(token: string, id: string) {
    return this.request(token, 'DELETE', env.DOTNET_EVENTS_PATH + '/' + id);
  }

  createNote(token: string, payload: unknown) {
    return this.request(token, 'POST', env.DOTNET_NOTES_PATH, payload);
  }

  updateNote(token: string, id: string, payload: unknown) {
    return this.request(
      token,
      'PATCH',
      env.DOTNET_NOTES_PATH + '/' + id,
      payload,
    );
  }

  deleteNote(token: string, id: string) {
    return this.request(token, 'DELETE', env.DOTNET_NOTES_PATH + '/' + id);
  }

  createWorklog(token: string, payload: unknown) {
    return this.request(token, 'POST', env.DOTNET_WORKLOGS_PATH, payload);
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

  private async request<T = unknown>(
    token: string,
    method: HttpMethod,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;

    // Abort the request if the .NET backend does not respond in time, so a
    // slow/unreachable host can never hang the socket handshake or a tool call.
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      env.DOTNET_API_TIMEOUT_MS,
    );

    try {
      response = await fetch(
        new URL(path, env.DOTNET_API_BASE_URL).toString(),
        {
          method,
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        },
      );
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ApiError(
        aborted ? 504 : 502,
        aborted
          ? `Timed out contacting .NET backend after ${env.DOTNET_API_TIMEOUT_MS}ms (${new URL(path, env.DOTNET_API_BASE_URL).toString()})`
          : 'Could not connect to existing .NET backend',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timer);
    }

    const text = await response.text();
    const payload = parseResponseBody(text);
    if (!response.ok) {
      throw new ApiError(
        response.status,
        payload?.message ?? 'Existing backend request failed',
        payload,
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
