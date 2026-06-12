import OpenAI from 'openai';
import { env } from '../config/env';
import { ToolName, openAiTools, systemPrompt } from './productivity-tools';
import { ToolExecutorService } from './tool-executor.service';

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

// Keep the system prompt plus a rolling window of recent turns so multi-turn
// flows (e.g. "summarize -> confirm -> execute") work without unbounded growth.
const MAX_HISTORY = 24;

export class OpenAiAssistantService {
  private readonly toolExecutor = new ToolExecutorService();
  private readonly client = env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : undefined;

  // Conversation memory for THIS voice session (one per socket connection).
  private readonly history: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

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

    this.pushMessage({ role: 'user', content: input.transcript });

    const first = await this.client.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: this.history,
      tools: openAiTools as never,
      tool_choice: 'auto',
    });

    const message = first.choices[0]?.message;
    const toolCalls = message?.tool_calls ?? [];
    const toolResults: Array<{ toolName: ToolName; result: unknown }> = [];

    if (toolCalls.length) {
      // Record the assistant's tool-call turn before adding tool outputs.
      this.pushMessage({
        role: 'assistant',
        content: message?.content ?? '',
        tool_calls: toolCalls,
      } as ChatMessage);

      for (const call of toolCalls) {
        if (call.type !== 'function') continue;
        const toolName = call.function.name as ToolName;
        const args = JSON.parse(call.function.arguments || '{}');
        const result = await this.toolExecutor.execute(
          input.token,
          toolName,
          args,
        );
        toolResults.push({ toolName, result });
        this.pushMessage({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result ?? {}),
        });
      }

      // Second round-trip so the assistant can confirm the result naturally
      // (and with the tool outputs in context).
      const second = await this.client.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: this.history,
      });
      const text = second.choices[0]?.message?.content || 'Done.';
      this.pushMessage({ role: 'assistant', content: text });
      return { text, toolResults };
    }

    const text =
      message?.content ||
      'Please confirm the action or provide the missing details.';
    this.pushMessage({ role: 'assistant', content: text });
    return { text, toolResults };
  }

  private pushMessage(message: ChatMessage) {
    this.history.push(message);
    // Trim oldest turns, stopping at a clean user-message boundary so we never
    // leave an orphaned tool message or dangling tool_call in the history.
    while (this.history.length > MAX_HISTORY && this.history.length > 1) {
      this.history.splice(1, 1);
      if (this.history[1]?.role === 'user') break;
    }
  }
}
