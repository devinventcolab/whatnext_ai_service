import { DotnetApiClient } from '../integrations/dotnet/dotnet-api.client';
import { ToolName, toolSchemas } from './productivity-tools';

export class ToolExecutorService {
  constructor(private readonly dotnetApi = new DotnetApiClient()) {}

  async execute(token: string, toolName: ToolName, rawArguments: unknown) {
    const args = toolSchemas[toolName].parse(rawArguments) as Record<
      string,
      unknown
    >;
    delete args.confirmed;

    if (toolName === 'createTask')
      return this.dotnetApi.createTask(token, args);
    if (toolName === 'updateTask')
      return this.dotnetApi.updateTask(token, String(args.id), withoutId(args));
    if (toolName === 'deleteTask')
      return this.dotnetApi.deleteTask(token, String(args.id));
    if (toolName === 'createEvent')
      return this.dotnetApi.createEvent(token, args);
    if (toolName === 'updateEvent')
      return this.dotnetApi.updateEvent(
        token,
        String(args.id),
        withoutId(args),
      );
    if (toolName === 'deleteEvent')
      return this.dotnetApi.deleteEvent(token, String(args.id));
    if (toolName === 'createNote')
      return this.dotnetApi.createNote(token, args);
    if (toolName === 'updateNote')
      return this.dotnetApi.updateNote(token, String(args.id), withoutId(args));
    if (toolName === 'deleteNote')
      return this.dotnetApi.deleteNote(token, String(args.id));
    if (toolName === 'createWorklog')
      return this.dotnetApi.createWorklog(token, args);
    if (toolName === 'updateWorklog')
      return this.dotnetApi.updateWorklog(
        token,
        String(args.id),
        withoutId(args),
      );
    return this.dotnetApi.deleteWorklog(token, String(args.id));
  }
}

function withoutId(args: Record<string, unknown>) {
  const copy = { ...args };
  delete copy.id;
  return copy;
}
