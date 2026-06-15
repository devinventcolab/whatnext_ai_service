import OpenAI from 'openai';
import { env } from '../config/env';
import { vlog } from '../shared/debug';
import { ToolExecutorService } from './tool-executor.service';
import { Intent, INTENTS, WORKERS } from './workers';

type Fields = Record<string, unknown>;
type Phase = 'idle' | 'collecting' | 'confirming';
type Command = 'provide' | 'confirm' | 'cancel' | 'modify' | 'none';

interface Nlu {
  intent: Intent | null;
  command: Command;
  fields: Fields;
  reply?: string;
}

export interface AssistantResult {
  text: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
}

// Reset the conversation if the user goes quiet for this long.
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Worker-based, deterministic conversation manager.
 *
 * The LLM is used only for NLU (detecting intent, classifying the user's
 * command, and extracting field values). All flow control — required-field
 * tracking, confirmation, intent switching, modification, and cancellation —
 * is handled here so creation can never happen without explicit confirmation.
 */
export class ConversationManagerService {
  private readonly client = env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : undefined;
  private readonly toolExecutor = new ToolExecutorService();

  // ----- per-session state -----
  private intent: Intent | null = null;
  private phase: Phase = 'idle';
  private fields: Fields = {};
  private lastActivityAt = Date.now();

  async handle(input: {
    token: string;
    transcript: string;
    userId: string;
  }): Promise<AssistantResult> {
    const text = input.transcript.trim();
    if (!text) return this.reply('Sorry, I didn’t catch that. Could you repeat?');
    if (!this.client) {
      return this.reply(
        'OpenAI API key is not configured, so I can’t process requests yet.',
      );
    }

    // Timeout: abandon a stale half-finished record.
    if (Date.now() - this.lastActivityAt > SESSION_TIMEOUT_MS) {
      vlog('worker', 'session timed out -> reset');
      this.reset();
    }
    this.lastActivityAt = Date.now();

    let nlu: Nlu;
    try {
      nlu = await this.classify(text);
    } catch (error) {
      vlog('worker', 'nlu error', (error as Error).message);
      return this.reply(
        'I had trouble understanding that. Could you say it again?',
      );
    }
    vlog('worker', 'nlu', nlu);

    // 1) Cancel abandons whatever is in progress.
    if (nlu.command === 'cancel') {
      const had = this.intent;
      this.reset();
      return this.reply(
        had
          ? `Okay, I’ve cancelled that ${WORKERS[had].noun}. What would you like to do next?`
          : 'Okay. What would you like to do?',
      );
    }

    // 2) Intent switch (or first intent). Switching starts a fresh worker.
    if (nlu.intent && nlu.intent !== this.intent) {
      const from = this.intent;
      this.switchTo(nlu.intent);
      vlog('worker', 'intent switch', { from, to: nlu.intent });
    }

    // 3) Nothing active and nothing detected -> guide the user.
    if (!this.intent) {
      return this.reply(
        nlu.reply ||
          'I can help you create a task, note, event, or worklog. Which would you like to do?',
      );
    }

    // 4) Merge any field values mentioned this turn.
    const provided = this.mergeFields(nlu.fields);

    // 5) Explicit confirmation -> create (only when fully collected).
    if (
      nlu.command === 'confirm' &&
      this.phase === 'confirming' &&
      this.missingRequired().length === 0
    ) {
      return this.create(input.token);
    }

    // 6) Still missing required fields -> ask a targeted question.
    const missing = this.missingRequired();
    if (missing.length) {
      this.phase = 'collecting';
      const field = WORKERS[this.intent].fields.find(
        (f) => f.name === missing[0],
      )!;
      const ack = provided ? 'Got it. ' : '';
      return this.reply(`${ack}${field.question}`);
    }

    // 7) Everything collected -> summarize and ask for confirmation.
    this.phase = 'confirming';
    const verb = nlu.command === 'modify' ? 'Updated.' : 'Great.';
    return this.reply(
      `${verb}\n${this.summary()}\n\nShould I create this ${WORKERS[this.intent].noun}?`,
    );
  }

  // ---------------------------------------------------------------------------

  private async classify(text: string): Promise<Nlu> {
    const now = new Date().toISOString();
    const fieldDocs = INTENTS.map((i) => {
      const spec = WORKERS[i];
      const fs = spec.fields
        .map(
          (f) =>
            `${f.name}${f.required ? '*' : ''}` +
            (f.enum ? ` (${f.enum.join('|')})` : '') +
            (f.type === 'number' ? ' (number)' : ''),
        )
        .join(', ');
      return `- ${i}: ${fs}`;
    }).join('\n');

    const system = [
      'You are the NLU router for a productivity voice assistant.',
      'Supported intents and their fields ("*" = required):',
      fieldDocs,
      `Current datetime (ISO): ${now}. Resolve relative dates/times like "tomorrow" or "3pm" into ISO 8601 strings.`,
      'Respond with ONLY a JSON object of this exact shape:',
      '{"intent":"task|note|event|worklog|null","command":"provide|confirm|cancel|modify|none","fields":{},"reply":""}',
      'Rules:',
      '- "intent": the intent the user is expressing now. If they are only answering a follow-up or changing a field, repeat the CURRENT intent. Set a NEW intent only if they clearly change their mind (e.g. "actually make a note instead").',
      '- "command": "confirm" when the user agrees to create (yes/yep/go ahead/confirm/create it); "cancel" when they abandon (cancel/never mind/stop/forget it); "modify" when they change an already-provided field; "provide" when they give new info; otherwise "none".',
      '- "fields": include ONLY fields explicitly mentioned this turn, using the exact field names above. Use allowed enum values verbatim. "duration" is a number of minutes. Do not invent values; omit unknowns.',
      '- "reply": only set this with a short clarification when the user is off-topic or ambiguous; otherwise use an empty string.',
    ].join('\n');

    const state = `Current intent: ${this.intent ?? 'none'}. Phase: ${this.phase}. Collected so far: ${JSON.stringify(this.fields)}.`;

    const res = await this.client!.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'system', content: state },
        { role: 'user', content: text },
      ],
    });

    return this.parseNlu(res.choices[0]?.message?.content || '{}');
  }

  private parseNlu(raw: string): Nlu {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      const intent = INTENTS.includes(o.intent as Intent)
        ? (o.intent as Intent)
        : null;
      const commands: Command[] = [
        'provide',
        'confirm',
        'cancel',
        'modify',
        'none',
      ];
      const command = commands.includes(o.command as Command)
        ? (o.command as Command)
        : 'none';
      const fields =
        o.fields && typeof o.fields === 'object'
          ? (o.fields as Fields)
          : {};
      const reply =
        typeof o.reply === 'string' && o.reply.trim() ? o.reply : undefined;
      return { intent, command, fields, reply };
    } catch {
      return { intent: this.intent, command: 'none', fields: {} };
    }
  }

  /** Merges recognized field values into state. Returns true if any applied. */
  private mergeFields(incoming: Fields): boolean {
    if (!this.intent || !incoming) return false;
    const spec = WORKERS[this.intent];
    let applied = false;
    for (const f of spec.fields) {
      const v = incoming[f.name];
      if (v === undefined || v === null || v === '') continue;
      if (f.type === 'number') {
        const n = Number(v);
        if (!Number.isNaN(n)) {
          this.fields[f.name] = n;
          applied = true;
        }
      } else if (f.type === 'array') {
        this.fields[f.name] = Array.isArray(v)
          ? v.map(String)
          : String(v)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
        applied = true;
      } else if (f.enum) {
        const s = String(v).toLowerCase();
        if (f.enum.includes(s)) {
          this.fields[f.name] = s;
          applied = true;
        }
      } else {
        this.fields[f.name] = String(v);
        applied = true;
      }
    }
    return applied;
  }

  private missingRequired(): string[] {
    if (!this.intent) return [];
    return WORKERS[this.intent].fields
      .filter(
        (f) =>
          f.required &&
          (this.fields[f.name] === undefined || this.fields[f.name] === ''),
      )
      .map((f) => f.name);
  }

  private summary(): string {
    const spec = WORKERS[this.intent!];
    const lines = spec.fields
      .filter(
        (f) => this.fields[f.name] !== undefined && this.fields[f.name] !== '',
      )
      .map((f) => `- ${f.label}: ${formatValue(this.fields[f.name])}`);
    return `Here’s the ${spec.noun} I have:\n${lines.join('\n')}`;
  }

  private async create(token: string): Promise<AssistantResult> {
    const spec = WORKERS[this.intent!];
    try {
      const result = await this.toolExecutor.execute(token, spec.createTool, {
        ...this.fields,
        confirmed: true,
      });
      vlog('worker', `${spec.createTool} created`);
      this.reset();
      return {
        text: `Done. I’ve created the ${spec.noun}.`,
        toolResults: [{ toolName: spec.createTool, result }],
      };
    } catch (error) {
      const message = (error as Error).message;
      vlog('worker', 'create failed', message);
      // Stay in confirming phase so the user can fix and retry.
      return {
        text: `I couldn’t create the ${spec.noun}: ${message}. Want to try again or change something?`,
        toolResults: [],
      };
    }
  }

  private switchTo(intent: Intent) {
    this.intent = intent;
    this.fields = {};
    this.phase = 'collecting';
  }

  private reset() {
    this.intent = null;
    this.fields = {};
    this.phase = 'idle';
  }

  private reply(text: string): AssistantResult {
    return { text, toolResults: [] };
  }
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}
