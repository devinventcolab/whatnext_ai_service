import { AuthContext } from '../auth/auth.types';
import { languageManager } from '../i18n/language-manager';
import { SupportedLanguage } from '../i18n/types';
import {
  ENTITY_SPECS,
  EntityQuery,
  EntityRecord,
  EntityType,
} from './entities';
import { EntityService } from './entity-service';
import { SpeechFormatter } from './speech-formatter';

type DeletePhase = 'idle' | 'selecting' | 'confirming';

export interface DeleteWorkerInput {
  auth: AuthContext;
  language: SupportedLanguage;
  entity: EntityType | null;
  query: EntityQuery;
  selection?: string;
  command: 'delete' | 'select' | 'confirm' | 'cancel';
}

export class DeleteWorkerService {
  private phase: DeletePhase = 'idle';
  private entity: EntityType | null = null;
  private matches: EntityRecord[] = [];
  private selected: EntityRecord | null = null;

  constructor(
    private readonly entities = new EntityService(),
    private readonly formatter = new SpeechFormatter(),
  ) {}

  isActive(): boolean {
    return this.phase !== 'idle';
  }

  reset() {
    this.phase = 'idle';
    this.entity = null;
    this.matches = [];
    this.selected = null;
  }

  async handle(input: DeleteWorkerInput): Promise<string> {
    if (input.command === 'cancel') {
      this.reset();
      return languageManager.t('delete.cancelled', input.language);
    }

    if (input.command === 'confirm') {
      return this.confirm(input.auth, input.language);
    }

    if (input.command === 'select') {
      return this.select(input.selection ?? input.query.text ?? '', input.language);
    }

    // Follow-up phrases like "delete Type of testing note" often arrive as a
    // new delete command instead of a select command. If we are already showing
    // choices, treat the phrase as a selection against the existing matches.
    if (input.command === 'delete' && this.phase === 'selecting') {
      const selected = this.select(input.selection ?? input.query.text ?? '', input.language);
      if (this.selected) return selected;
    }

    if (input.entity && (!this.entity || input.entity !== this.entity)) {
      this.entity = input.entity;
      this.matches = [];
      this.selected = null;
      this.phase = 'idle';
    }

    if (!this.entity) return languageManager.t('delete.whichEntity', input.language);

    const listed = await this.entities.list(input.auth, this.entity, input.query);
    if (!listed.ok) return this.failure(listed.message, input.language);
    this.matches = listed.value;

    if (!this.matches.length) {
      this.reset();
      return languageManager.t('delete.noMatches', input.language, {
        entity: plural(this.entity, input.language),
      });
    }

    if (this.matches.length > 1) {
      this.phase = 'selecting';
      return this.selectionPrompt(input.language);
    }

    this.selected = this.matches[0];
    this.phase = 'confirming';
    return this.confirmation(input.language);
  }

  private select(text: string, language: SupportedLanguage): string {
    const match = resolveSelection(this.matches, text);
    if (!match) return languageManager.t('delete.selectionNotFound', language);
    this.selected = match;
    this.phase = 'confirming';
    return this.confirmation(language);
  }

  private async confirm(
    auth: AuthContext,
    language: SupportedLanguage,
  ): Promise<string> {
    if (!this.entity || !this.selected) {
      return languageManager.t('delete.nothingToConfirm', language);
    }
    if (!this.selected.id) return languageManager.t('delete.missingId', language);

    const result = await this.entities.delete(auth, this.entity, this.selected.id);
    if (!result.ok) return this.failure(result.message, language);

    const entity = noun(this.entity, language);
    this.reset();
    return languageManager.t('delete.deleted', language, { entity });
  }

  private selectionPrompt(language: SupportedLanguage): string {
    const lines = this.matches.slice(0, 5).map((record, index) => {
      return `${index + 1}. ${this.formatter.formatRecord(record, language)}`;
    });
    return (
      languageManager.t('delete.multipleMatches', language, {
        entity: plural(this.entity!, language),
      }) +
      '\n' +
      lines.join('\n') +
      '\n' +
      languageManager.t('delete.selectPrompt', language)
    );
  }

  private confirmation(language: SupportedLanguage): string {
    return languageManager.t('delete.confirm', language, {
      entity: noun(this.entity!, language),
      record: this.selected
        ? this.formatter.formatRecord(this.selected, language)
        : '',
    });
  }

  private failure(message: string, language: SupportedLanguage): string {
    if (message.includes('not configured')) {
      return languageManager.t('delete.notConfigured', language, {
        entity: plural(this.entity!, language),
      });
    }
    return languageManager.t('delete.failed', language, { error: message });
  }
}

function resolveSelection(
  records: readonly EntityRecord[],
  text: string,
): EntityRecord | undefined {
  const clean = normalizeSelectionText(text);
  const index = parseIndex(clean);
  if (index !== undefined) return records[index];
  return records.find((record) => {
    const title = normalizeSelectionText(record.title);
    const summary = normalizeSelectionText(record.summary ?? '');
    return (
      normalizeSelectionText(record.id) === clean ||
      title.includes(clean) ||
      clean.includes(title) ||
      (summary && (summary.includes(clean) || clean.includes(summary)))
    );
  });
}

function normalizeSelectionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(
      /\b(should|i|delete|remove|erase|note|task|event|worklog|the|one|please|would|like|to|my)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function parseIndex(text: string): number | undefined {
  const numeric = text.match(/\b(\d+)\b/);
  if (numeric) return Number(numeric[1]) - 1;
  if (/\b(first|one|prvi|prva)\b/i.test(text)) return 0;
  if (/\b(second|two|drugi|druga)\b/i.test(text)) return 1;
  if (/\b(third|three|treci|treći|treca|treća)\b/i.test(text)) return 2;
  return undefined;
}

function noun(entity: EntityType, language: SupportedLanguage): string {
  return languageManager.t(ENTITY_SPECS[entity].nounKey, language);
}

function plural(entity: EntityType, language: SupportedLanguage): string {
  return languageManager.t(ENTITY_SPECS[entity].pluralKey, language);
}
