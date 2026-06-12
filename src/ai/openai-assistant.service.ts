import OpenAI from 'openai';
import { env } from '../config/env';
import { ToolName, openAiTools, systemPrompt } from './productivity-tools';
import { ToolExecutorService } from './tool-executor.service';

export class OpenAiAssistantService {
  private readonly toolExecutor = new ToolExecutorService();
  private readonly client = env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : undefined;

  async handleTranscript(input: {
    token: string;
    transcript: string;
    userId: string;
  }) {
    if (!this.client) {
      return {
        text: 'OpenAI API key is not configured. I received your voice text but cannot process actions yet.',
        toolResults: [],
      };
    }

    const response = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input.transcript },
      ],
      tools: openAiTools as never,
      tool_choice: 'auto',
    });

    const message = response.choices[0]?.message;
    const toolResults: Array<{ toolName: ToolName; result: unknown }> = [];

    for (const call of message?.tool_calls ?? []) {
      if (call.type !== 'function') continue;
      const toolName = call.function.name as ToolName;
      const args = JSON.parse(call.function.arguments || '{}');
      const result = await this.toolExecutor.execute(
        input.token,
        toolName,
        args,
      );
      toolResults.push({ toolName, result });
    }

    return {
      text:
        message?.content ||
        (toolResults.length
          ? 'Done.'
          : 'Please confirm the action or provide the missing details.'),
      toolResults,
    };
  }
}
