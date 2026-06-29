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

type UpdatePhase = 'idle' | 'selecting' | 'collecting_changes' | 'confirming';

export interface UpdateWorkerResult {
  text: string;
  updated?: {
    toolName: string;
    result: unknown;
  };
  entity?: EntityType;
  patch?: Record<string, unknown>;
  fullRecord?: Record<string, unknown>;
}

export interface UpdateWorkerInput {
  auth: AuthContext;
  language: SupportedLanguage;
  entity: EntityType | null;
  query: EntityQuery;
  patch: Record<string, unknown>;
  selection?: string;
  command: 'update' | 'select' | 'modify' | 'confirm' | 'cancel';
}

export class UpdateWorkerService {
  private phase: UpdatePhase = 'idle';
  private entity: EntityType | null = null;
  private matches: EntityRecord[] = [];
  private selected: EntityRecord | null = null;
  private patch: Record<string, unknown> = {};

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
    this.patch = {};
  }

  async handle(input: UpdateWorkerInput): Promise<UpdateWorkerResult> {
    if (input.command === 'cancel') {
      this.reset();
      return { text: languageManager.t('update.cancelled', input.language) };
    }

    if (input.command === 'confirm') {
      return this.confirm(input.auth, input.language);
    }

    if (input.command === 'select') {
      return {
        text: this.select(
          input.selection ?? input.query.text ?? '',
          input.language,
        ),
      };
    }

    if (input.command === 'modify' && this.selected) {
      this.mergePatch(input.patch);
      this.phase = 'confirming';
      return { text: this.confirmation(input.language) };
    }

    if (input.entity && (!this.entity || input.entity !== this.entity)) {
      this.entity = input.entity;
      this.matches = [];
      this.selected = null;
      this.patch = {};
      this.phase = 'idle';
    }

    if (!this.entity) {
      return { text: languageManager.t('update.whichEntity', input.language) };
    }

    if (!this.matches.length && !this.selected) {
      const listed = await this.entities.list(
        input.auth,
        this.entity,
        input.query,
      );
      if (!listed.ok) return { text: this.failure(listed.message, input.language) };
      this.matches = listed.value;
      if (!this.matches.length) {
        this.reset();
        return {
          text: languageManager.t('update.noMatches', input.language, {
            entity: plural(this.entity, input.language),
          }),
        };
      }
      if (this.matches.length > 1) {
        this.phase = 'selecting';
        return { text: this.selectionPrompt(input.language) };
      }
      this.selected = this.matches[0];
    }

    this.mergePatch(input.patch);
    if (!Object.keys(this.patch).length) {
      this.phase = 'collecting_changes';
      return {
        text: languageManager.t('update.whatChange', input.language, {
          entity: noun(this.entity, input.language),
          record: this.selectedLabel(input.language),
        }),
      };
    }

    this.phase = 'confirming';
    return { text: this.confirmation(input.language) };
  }

  private select(text: string, language: SupportedLanguage): string {
    const match = resolveSelection(this.matches, text);
    if (!match) {
      return languageManager.t('update.selectionNotFound', language);
    }
    this.selected = match;
    this.phase = Object.keys(this.patch).length
      ? 'confirming'
      : 'collecting_changes';
    return Object.keys(this.patch).length
      ? this.confirmation(language)
      : languageManager.t('update.whatChange', language, {
          entity: noun(this.entity!, language),
          record: this.selectedLabel(language),
        });
  }

  private async confirm(
    auth: AuthContext,
    language: SupportedLanguage,
  ): Promise<UpdateWorkerResult> {
    if (!this.entity || !this.selected || !Object.keys(this.patch).length) {
      return { text: languageManager.t('update.nothingToConfirm', language) };
    }
    if (!this.selected.id) {
      return { text: languageManager.t('update.missingId', language) };
    }
    const result = await this.entities.update(
      auth,
      this.entity,
      this.selected.id,
      this.patch,
      this.selected,
    );
    if (!result.ok) return { text: this.failure(result.message, language) };
    const text = buildNaturalConfirmation(this.entity, this.patch, this.formatter, language);
    const updateTool = ENTITY_SPECS[this.entity].updateTool!;
    const updated = {
      toolName: updateTool,
      result: result.value,
    };
    const entity = this.entity;
    const patch = { ...this.patch };
    const fullRecord = {
      ...this.selected.raw,
      ...this.patch,
    };
    this.reset();
    return { text, updated, entity, patch, fullRecord };
  }

  private mergePatch(patch: Record<string, unknown>) {
    for (const [key, value] of Object.entries(patch ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      this.patch[key] = value;
    }
  }

  private selectionPrompt(language: SupportedLanguage): string {
    const lines = this.matches.slice(0, 5).map((record, index) => {
      return `${index + 1}. ${this.formatter.formatRecord(record, language)}`;
    });
    return (
      languageManager.t('update.multipleMatches', language, {
        entity: plural(this.entity!, language),
      }) +
      '\n' +
      lines.join('\n') +
      '\n' +
      languageManager.t('update.selectPrompt', language)
    );
  }

  private confirmation(language: SupportedLanguage): string {
    const changes = Object.entries(this.patch)
      .map(([key, value]) => {
        const label = languageManager.t(
          `field.${this.entity}.${key}.label`,
          language,
        );
        return `- ${label}: ${this.formatter.formatValue(value, language)}`;
      })
      .join('\n');
    return (
      languageManager.t('update.summaryHeader', language, {
        record: this.selectedLabel(language),
      }) +
      '\n' +
      changes +
      '\n\n' +
      languageManager.t('update.confirm', language, {
        entity: noun(this.entity!, language),
      })
    );
  }

  private selectedLabel(language: SupportedLanguage): string {
    return this.selected
      ? this.formatter.formatRecord(this.selected, language)
      : '';
  }

  private failure(message: string, language: SupportedLanguage): string {
    if (message.includes('not configured')) {
      return languageManager.t('update.notConfigured', language, {
        entity: plural(this.entity!, language),
      });
    }
    return languageManager.t('update.failed', language, { error: message });
  }
}

function resolveSelection(
  records: readonly EntityRecord[],
  text: string,
): EntityRecord | undefined {
  const clean = text.trim().toLowerCase();
  const index = parseIndex(clean);
  if (index !== undefined) return records[index];
  return records.find((record) => {
    return (
      record.id.toLowerCase() === clean ||
      record.title.toLowerCase().includes(clean) ||
      clean.includes(record.title.toLowerCase())
    );
  });
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

function buildNaturalConfirmation(
  entity: EntityType,
  patch: Record<string, unknown>,
  formatter: SpeechFormatter,
  language: SupportedLanguage,
): string {
  const entityNoun = languageManager.t(`noun.${entity}`, language);

  const changes = Object.entries(patch).map(([key, value]) => {
    const label = languageManager.t(`field.${entity}.${key}.label`, language).toLowerCase();
    const formattedVal = formatter.formatValue(value, language);

    if (language === 'sr') {
      return `${label} na **${formattedVal}**`;
    } else {
      return `${label} to **${formattedVal}**`;
    }
  });

  if (changes.length === 0) {
    if (language === 'sr') {
      return `Gotovo! Ažurirao sam ${entityNoun}.`;
    }
    return `Done! I've updated the ${entityNoun}.`;
  }

  let changesText = '';
  if (changes.length === 1) {
    changesText = changes[0];
  } else {
    const last = changes[changes.length - 1];
    const rest = changes.slice(0, changes.length - 1);
    const andWord = language === 'sr' ? ' i ' : ' and ';
    changesText = rest.join(', ') + andWord + last;
  }

  if (language === 'sr') {
    return `Gotovo! Ažurirao sam ${entityNoun}: promenio sam ${changesText}.`;
  }
  return `Done! I've updated the ${entityNoun} by changing the ${changesText}.`;
}
