import OpenAI from 'openai';
import { env } from '../config/env';
import { languageManager } from '../i18n/language-manager';
import { SupportedLanguage } from '../i18n/types';
import { ApiError } from '../shared/errors/api-error';
import { vlog } from '../shared/debug';
import { DeleteWorkerService } from './delete-worker.service';
import { EntityQuery, EntityType, isEntityType } from './entities';
import { QueryMode, QueryWorkerService } from './query-worker.service';
import { ToolExecutorService } from './tool-executor.service';
import { UpdateWorkerService } from './update-worker.service';
import { SpeechFormatter } from './speech-formatter';
import { Intent, INTENTS, WORKERS } from './workers';

type Fields = Record<string, unknown>;
type Phase = 'idle' | 'collecting' | 'confirming';
type Command =
  | 'create'
  | 'provide'
  | 'query'
  | 'update'
  | 'delete'
  | 'select'
  | 'confirm'
  | 'cancel'
  | 'modify'
  | 'close'
  | 'none';

interface Nlu {
  intent: Intent | null;
  entity: EntityType | 'all' | null;
  command: Command;
  queryMode: QueryMode;
  query: EntityQuery;
  fields: Fields;
  selection?: string;
  language: SupportedLanguage | null;
  reply?: string;
}

export interface AssistantResult {
  text: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
  /** Language the reply is written in, so the caller can pick the TTS voice. */
  language: SupportedLanguage;
}

// Reset the conversation if the user goes quiet for this long.
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Worker-based, deterministic, language-aware conversation manager.
 *
 * The LLM is used only for NLU (detecting intent + language, classifying the
 * command, and extracting field values). All flow control and all user-facing
 * text is handled here, with strings resolved from i18n in the active language.
 */
export class ConversationManagerService {
  private readonly client = env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
    : undefined;
  private readonly toolExecutor = new ToolExecutorService();
  private readonly queryWorker = new QueryWorkerService();
  private readonly updateWorker = new UpdateWorkerService();
  private readonly deleteWorker = new DeleteWorkerService();
  private readonly speechFormatter = new SpeechFormatter();

  // ----- per-session state -----
  private intent: Intent | null = null;
  private phase: Phase = 'idle';
  private fields: Fields = {};
  private invalidField?: { name: string; allowed: readonly string[] };
  /** Active session language; persists across resets within the session. */
  private language: SupportedLanguage = languageManager.defaultLanguage;
  private lastActivityAt = Date.now();

  /** Current session language (for the caller, e.g. TTS voice selection). */
  get activeLanguage(): SupportedLanguage {
    return this.language;
  }

  async handle(input: {
    token: string;
    transcript: string;
    userId: string;
  }): Promise<AssistantResult> {
    const text = input.transcript.trim();
    if (!text) return this.reply('msg.cantHear');
    if (!this.client) return this.reply('msg.noApiKey');

    // Timeout: abandon a stale half-finished record (language is preserved).
    if (Date.now() - this.lastActivityAt > SESSION_TIMEOUT_MS) {
      vlog('worker', 'session timed out -> reset');
      this.reset();
    }
    this.lastActivityAt = Date.now();

    // Serbian greetings: Zdravo / Ćao / Cao / Ciao should respond in Serbian but NOT switch the session language.
    if (isSerbianGreeting(text)) {
      vlog('worker', 'Serbian greeting fast-path triggered');
      const greetingText = text.trim().replace(/[.!?,]+$/g, '');
      const capitalizedGreeting =
        greetingText.charAt(0).toUpperCase() + greetingText.slice(1);
      const body = languageManager.t('msg.chooseIntent', 'sr');
      return {
        text: `${capitalizedGreeting}! ${body}`,
        toolResults: [],
        language: 'sr',
      };
    }

    // Fast path: a plain closing/thank-you ("thanks", "ok thank you", "bye",
    // "hvala", "doviđenja") ends the conversation politely. Handled before the
    // NLU call so it is reliable even if the model is unavailable/rate-limited.
    if (isClosingPhrase(text)) {
      const lang = languageManager.detect(text) ?? this.language;
      this.language = lang;
      vlog('worker', 'closing conversation');
      this.reset();
      this.updateWorker.reset();
      this.deleteWorker.reset();
      return this.reply('msg.closing');
    }

    let nlu: Nlu;
    try {
      nlu = await this.classify(text);
    } catch (error) {
      vlog('worker', 'nlu error', (error as Error).message);
      return this.reply('msg.nluError');
    }

    // Language detection / switching. NLU first, heuristic as a fallback.
    const detected = nlu.language ?? languageManager.detect(text);
    if (detected && detected !== this.language) {
      vlog('worker', 'language switch', { from: this.language, to: detected });
      this.language = detected;
    }
    vlog('worker', 'nlu', { ...nlu, language: this.language });

    // 1) Cancel abandons whatever is in progress.
    if (nlu.command === 'cancel') {
      const had = this.intent;
      this.reset();
      this.updateWorker.reset();
      this.deleteWorker.reset();
      return had
        ? this.reply('msg.cancelled', { noun: this.noun(had) })
        : this.reply('msg.cancelledNone');
    }

    // 1b) Close ends the conversation politely (NLU-detected farewell/thanks).
    if (nlu.command === 'close') {
      vlog('worker', 'closing conversation (nlu)');
      this.reset();
      this.updateWorker.reset();
      this.deleteWorker.reset();
      return this.reply('msg.closing');
    }

    const auth = {
      token: input.token,
      user: { id: input.userId },
    };

    if (nlu.command === 'query') {
      return this.rawReply(
        await this.queryWorker.handle({
          auth,
          language: this.language,
          entity: nlu.entity,
          mode: nlu.queryMode,
          query: nlu.query,
        }),
      );
    }

    const activeDeleteCommand = this.deleteWorker.isActive()
      ? coerceActiveDeleteCommand(nlu.command, text)
      : nlu.command;
    if (
      nlu.command === 'delete' ||
      (this.deleteWorker.isActive() &&
        ['delete', 'select', 'confirm'].includes(activeDeleteCommand))
    ) {
      return this.rawReply(
        await this.deleteWorker.handle({
          auth,
          language: this.language,
          entity: nlu.entity === 'all' ? null : nlu.entity,
          query: nlu.query,
          selection: nlu.selection ?? text,
          command: activeDeleteCommand as 'delete' | 'select' | 'confirm',
        }),
      );
    }

    if (
      nlu.command === 'update' ||
      (nlu.command === 'select' && this.updateWorker.isActive()) ||
      (this.updateWorker.isActive() &&
        ['modify', 'confirm', 'provide'].includes(nlu.command))
    ) {
      return this.rawReply(
        await this.updateWorker.handle({
          auth,
          language: this.language,
          entity: nlu.entity === 'all' ? null : nlu.entity,
          query: nlu.query,
          patch: nlu.fields,
          selection: nlu.selection,
          command:
            nlu.command === 'provide'
              ? 'modify'
              : (nlu.command as 'update' | 'select' | 'modify' | 'confirm'),
        }),
      );
    }

    // 2) Intent switch (or first intent). Switching starts a fresh worker.
    if (
      nlu.intent &&
      nlu.intent !== this.intent &&
      ['create', 'provide', 'modify', 'none'].includes(nlu.command)
    ) {
      const from = this.intent;
      this.switchTo(nlu.intent);
      vlog('worker', 'intent switch', { from, to: nlu.intent });
    }

    // 3) Nothing active and nothing detected -> guide the user.
    if (!this.intent) {
      return nlu.reply
        ? this.rawReply(nlu.reply)
        : this.reply('msg.chooseIntent');
    }

    // 4) Merge any field values mentioned this turn, then auto-fill defaults.
    const provided = this.mergeFields(nlu.fields);
    this.applyDefaults(input.userId);
    if (this.invalidField && this.intent) {
      const field = this.invalidField;
      this.invalidField = undefined;
      return this.rawReply(
        languageManager.t('msg.invalidEnum', this.language, {
          field: languageManager.t(
            `field.${this.intent}.${field.name}.label`,
            this.language,
          ),
          values: field.allowed.join(', '),
        }),
      );
    }

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
      const ack = provided ? languageManager.t('msg.ack', this.language) : '';
      const question = languageManager.t(
        `field.${this.intent}.${missing[0]}.question`,
        this.language,
      );
      return this.rawReply(`${ack}${question}`);
    }

    // 7) Everything collected -> summarize and ask for confirmation.
    this.phase = 'confirming';
    const lead = languageManager.t(
      nlu.command === 'modify' ? 'msg.updated' : 'msg.great',
      this.language,
    );
    const confirm = languageManager.t('msg.confirmCreate', this.language, {
      noun: this.noun(this.intent),
    });
    return this.rawReply(`${lead}\n${this.summary()}\n\n${confirm}`);
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

    const langs = languageManager.supportedLanguages.join('|');
    const system = [
      'You are the NLU router for a multilingual productivity voice assistant.',
      'Supported intents and their fields ("*" = required):',
      fieldDocs,
      `Current datetime (ISO): ${now}. Resolve relative dates/times like "tomorrow" or "3pm" into ISO 8601 strings.`,
      'Respond with ONLY a JSON object of this exact shape:',
      `{"intent":"task|note|event|worklog|null","entity":"task|note|event|worklog|reminder|all|null","command":"create|provide|query|update|delete|select|confirm|cancel|modify|close|none","queryMode":"count|list|search|detail","query":{},"fields":{},"selection":"","language":"${langs}","reply":""}`,
      'Rules:',
      '- "intent": only for CREATE flows (task/note/event/worklog). If the user is creating something or answering create follow-ups, set it. For query/update-only messages, use null unless a create flow is active.',
      '- "entity": the entity being queried/updated/selected. Use "all" for requests like "all my records". For create-only messages, mirror intent.',
      `- "language": the ISO code of the language the user wrote/spoke in (${langs}). Detect it from THIS message; if it is too short to tell, repeat the current session language.`,
      '- "command": "create" when the user starts creating a record; "query" for count/list/search/detail requests; "update" for update/reschedule/change existing record requests; "delete" for deleting/removing an existing record; "select" when the user chooses from a list; "confirm" when the user agrees to create/update/delete (e.g. yes / da / go ahead); "cancel" only when they abandon the current flow (e.g. cancel/never mind/stop); "close" when the user ends the conversation or just thanks you with no further request (e.g. thank you / ok thanks / that\'s all / bye / hvala / doviđenja). IMPORTANT: delete/remove a task/note/event/worklog is "delete", not "cancel". "modify" when they change already-provided data; "provide" when they give new info in an active flow; otherwise "none".',
      '- If the system state says a delete flow is active and the user names a record/title or says a number, use command "select" and put the phrase in "selection" even if they repeat the word delete.',
      '- "queryMode": "count" for how many/count; "list" for show/list; "search" when matching by title/topic/date; "detail" for one record details.',
      '- "query": include text/status/dateFrom/dateTo/limit filters explicitly requested. For tomorrow/yesterday/today ranges, emit ISO dateFrom/dateTo.',
      '- "selection": when command is select, copy the selection phrase (e.g. "first one", "project note", or an ID).',
      '- "fields": include ONLY fields explicitly mentioned this turn, using the exact field names above. Use allowed enum values verbatim. "duration" is minutes (number); "estimated_time" is hours (number); dates/times must be ISO 8601 strings (YYYY-MM-DD for date-only when no time is specified, YYYY-MM-DDTHH:mm:ss when time is explicitly mentioned). Field VALUES should stay in the user\'s language. Do not invent values; omit unknowns.',
      '- When a user specifies multiple fields in a single sentence (e.g., "title will be what next project will be mobile app domain will be finance"), do NOT merge the subsequent field names (like "project", "domain") or their values into previous fields (like "title"). Correctly identify where each field begins and ends, and extract them separately.',
      '- NEVER infer or default the task "assignee". Only set "assignee" when the user explicitly names who is responsible (e.g. "assign it to John", "give it to Sara"). Do NOT set it to "me", the current user, or anyone the user did not name — leave it out so the assistant can ask.',
      '- "reply": only set this (in the user\'s language) with a short clarification when the user is off-topic or ambiguous; otherwise use an empty string.',
      'Examples:',
      '1. User transcript: "create a task for me title will be what next project will be mobile app domain will be finance assigning will be Rajshree priority will be low due date will be 28 June 2026 objective will test today and description need complete"',
      '   Expected JSON response:',
      '   {"intent":"task","entity":"task","command":"create","fields":{"title":"what next","project":"mobile app","domain":"finance","assignee":"Rajshree","priority":"low","dueDate":"2026-06-28","objective":"test today","description":"need complete"}}',
      '2. User transcript: "add note title work update content finished the reports"',
      '   Expected JSON response:',
      '   {"intent":"note","entity":"note","command":"create","fields":{"title":"work update","content":"finished the reports"}}',
    ].join('\n');

    const state = `Current intent: ${this.intent ?? 'none'}. Phase: ${this.phase}. Delete flow active: ${this.deleteWorker.isActive()}. Update flow active: ${this.updateWorker.isActive()}. Session language: ${this.language}. Collected so far: ${JSON.stringify(this.fields)}.`;

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
      const entity =
        o.entity === 'all' ? 'all' : isEntityType(o.entity) ? o.entity : intent;
      const commands: Command[] = [
        'create',
        'provide',
        'query',
        'update',
        'delete',
        'select',
        'confirm',
        'cancel',
        'modify',
        'close',
        'none',
      ];
      const command = commands.includes(o.command as Command)
        ? (o.command as Command)
        : 'none';
      const fields =
        o.fields && typeof o.fields === 'object' ? (o.fields as Fields) : {};
      const query =
        o.query && typeof o.query === 'object' ? (o.query as EntityQuery) : {};
      const queryModes: QueryMode[] = ['count', 'list', 'search', 'detail'];
      const queryMode = queryModes.includes(o.queryMode as QueryMode)
        ? (o.queryMode as QueryMode)
        : 'list';
      const selection =
        typeof o.selection === 'string' && o.selection.trim()
          ? o.selection
          : undefined;
      const language = languageManager.isSupported(o.language as string)
        ? (o.language as SupportedLanguage)
        : null;
      const reply =
        typeof o.reply === 'string' && o.reply.trim() ? o.reply : undefined;
      return {
        intent,
        entity,
        command,
        queryMode,
        query,
        fields,
        selection,
        language,
        reply,
      };
    } catch {
      return {
        intent: this.intent,
        entity: this.intent,
        command: 'none',
        queryMode: 'list',
        query: {},
        fields: {},
        language: null,
      };
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
        const match = f.enum.find((e) => e.toLowerCase() === s);
        if (match) {
          this.fields[f.name] = match;
          applied = true;
        } else {
          this.invalidField = { name: f.name, allowed: f.enum };
        }
      } else {
        this.fields[f.name] = String(v);
        applied = true;
      }
    }
    return applied;
  }

  /** Fills optional fields that have a default and are still empty. */
  private applyDefaults(userId: string) {
    if (!this.intent) return;
    const ctx = { now: new Date(), userId, fields: this.fields };
    for (const f of WORKERS[this.intent].fields) {
      // Required fields must be explicitly collected from the user. Defaults are
      // allowed only for optional backend conveniences.
      if (f.required) continue;
      if (!f.default) continue;
      const v = this.fields[f.name];
      if (v === undefined || v === null || v === '') {
        this.fields[f.name] = f.default(ctx);
      }
    }
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
    const intent = this.intent!;
    const header = languageManager.t('msg.summaryHeader', this.language, {
      noun: this.noun(intent),
    });
    const lines = WORKERS[intent].fields.map((f) => {
      const label = languageManager.t(
        `field.${intent}.${f.name}.label`,
        this.language,
      );
      const v = this.fields[f.name];
      const isEmpty =
        v === undefined ||
        v === null ||
        v === '' ||
        (Array.isArray(v) && v.length === 0);
      const value = isEmpty
        ? languageManager.t('msg.notSet', this.language)
        : f.name === 'estimated_time'
          ? this.speechFormatter.formatEstimatedTime(v, this.language)
          : formatValue(v);
      return `- ${label}: ${value}`;
    });
    return `${header}\n${lines.join('\n')}`;
  }

  private async create(token: string): Promise<AssistantResult> {
    const intent = this.intent!;
    const spec = WORKERS[intent];
    const noun = this.noun(intent);
    try {
      const result = await this.toolExecutor.execute(token, spec.createTool, {
        ...this.fields,
        confirmed: true,
      });
      vlog('worker', `${spec.createTool} created`);
      this.reset();
      return {
        text: languageManager.t('msg.created', this.language, { noun }),
        toolResults: [{ toolName: spec.createTool, result }],
        language: this.language,
      };
    } catch (error) {
      const message = (error as Error).message;
      vlog('worker', 'create failed', {
        message,
        details: error instanceof ApiError ? error.details : undefined,
      });
      // Stay in confirming phase so the user can fix and retry.
      return {
        text: languageManager.t('msg.createFailed', this.language, {
          noun,
          error: message,
        }),
        toolResults: [],
        language: this.language,
      };
    }
  }

  private noun(intent: Intent): string {
    return languageManager.noun(intent, this.language);
  }

  private switchTo(intent: Intent) {
    this.intent = intent;
    this.fields = {};
    this.invalidField = undefined;
    this.phase = 'collecting';
  }

  private reset() {
    this.intent = null;
    this.fields = {};
    this.invalidField = undefined;
    this.phase = 'idle';
  }

  /** Builds a result from a translation key. */
  private reply(
    key: string,
    vars?: Record<string, string | number>,
  ): AssistantResult {
    return this.rawReply(languageManager.t(key, this.language, vars));
  }

  /** Builds a result from already-localized text. */
  private rawReply(text: string): AssistantResult {
    return { text, toolResults: [], language: this.language };
  }
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/**
 * True when the whole message is just a closing/thank-you/farewell, so the
 * assistant can wrap up politely. Matched deterministically (English + Serbian)
 * so it works even when the LLM NLU is unavailable. Only matches when the
 * message is essentially the closing itself, not when more requests follow.
 */
function isClosingPhrase(text: string): boolean {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, '')
    .trim();
  if (!clean) return false;
  const patterns: RegExp[] = [
    // English: thanks / thank you (optionally prefixed with ok/okay/alright)
    /^(ok(ay)?|alright|cool|great|perfect)?\s*(thank you( so much| very much)?|thanks( a lot| so much| very much)?|thankyou|thx|ty)$/,
    // English: goodbye / see you / talk later
    /^(ok(ay)?|alright|cool|great)?\s*(bye|goodbye|good bye|see you( later)?|see ya|catch you later|talk (to you )?later)$/,
    // English: that's all / nothing else / we're done
    /^(no[, ]+)?(that'?s (all|it)|that will be all|that'?ll be all|nothing else|i'?m done|we'?re done|all done|that is all)$/,
    // Serbian: thanks (optionally prefixed with ok)
    /^(ok(ej)?)?\s*((puno |mnogo |veliko )?hvala( ti| vam| puno| mnogo)?)$/,
    // Serbian: goodbye / see you
    /^(doviđenja|dovidjenja|prijatno|čujemo se|cujemo se)$/,
    // Serbian: that's all / we're done
    /^(to je sve|nema više|nema vise|gotovo|završili smo|zavrsili smo)$/,
  ];
  return patterns.some((re) => re.test(clean));
}

function coerceActiveDeleteCommand(command: Command, text: string): Command {
  if (command === 'confirm' || command === 'select' || command === 'delete') {
    return command;
  }
  const clean = text.trim().toLowerCase();
  if (
    /^(yes|yeah|yep|ok|okay|sure|confirm|go ahead|do it|delete it|please delete|da|može|moze|potvrdi|obriši|obrisi)\b/i.test(
      clean,
    )
  ) {
    return 'confirm';
  }
  // In an active delete flow, a non-affirmative follow-up is most likely the
  // user's selection phrase (e.g. "type of testing note").
  return 'select';
}

/**
 * True when the whole message is just a Serbian greeting (like "Zdravo", "Ćao", "Cao", "Ciao",
 * or combinations of these like "Zdravo, ćao").
 */
function isSerbianGreeting(text: string): boolean {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, '')
    .trim();
  if (!clean) return false;
  return /^(zdravo|ćao|cao|ciao)(?:\s*,\s*|\s+)?(zdravo|ćao|cao|ciao)?$/i.test(
    clean,
  );
}
