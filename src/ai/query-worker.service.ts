import { AuthContext } from '../auth/auth.types';
import { languageManager } from '../i18n/language-manager';
import { SupportedLanguage } from '../i18n/types';
import {
  ENTITY_SPECS,
  ENTITY_TYPES,
  EntityQuery,
  EntityRecord,
  EntityType,
} from './entities';
import { EntityService } from './entity-service';
import { SpeechFormatter } from './speech-formatter';

export type QueryMode = 'count' | 'list' | 'search' | 'detail';

export interface QueryWorkerInput {
  auth: AuthContext;
  language: SupportedLanguage;
  entity: EntityType | 'all' | null;
  mode: QueryMode;
  query: EntityQuery;
}

export class QueryWorkerService {
  constructor(
    private readonly entities = new EntityService(),
    private readonly formatter = new SpeechFormatter(),
  ) {}

  async handle(input: QueryWorkerInput): Promise<string> {
    const targets =
      input.entity && input.entity !== 'all'
        ? [input.entity]
        : [...ENTITY_TYPES];

    if (input.mode === 'count' || input.entity === 'all') {
      return this.countMany(input, targets);
    }

    const entity = targets[0];
    const id = detailId(input.query);
    if (input.mode === 'detail' && id) {
      const detail = await this.entities.getById(input.auth, entity, id);
      if (!detail.ok)
        return this.failure(detail.message, entity, input.language);
      if (!detail.value) {
        return languageManager.t('query.noResults', input.language, {
          entity: plural(entity, input.language),
        });
      }
      return this.listRecords(entity, [detail.value], input.language);
    }

    const result = await this.entities.list(input.auth, entity, input.query);
    if (!result.ok) return this.failure(result.message, entity, input.language);
    if (!result.value.length) {
      return languageManager.t('query.noResults', input.language, {
        entity: plural(entity, input.language),
      });
    }
    return this.listRecords(entity, result.value, input.language);
  }

  private async countMany(
    input: QueryWorkerInput,
    targets: readonly EntityType[],
  ): Promise<string> {
    const lines: string[] = [];
    for (const entity of targets) {
      const result = await this.entities.count(input.auth, entity, input.query);
      if (!result.ok) {
        if (input.entity === 'all' && result.reason === 'not_configured')
          continue;
        return this.failure(result.message, entity, input.language);
      }
      lines.push(
        languageManager.t('query.countLine', input.language, {
          count: result.value,
          entity: plural(entity, input.language),
        }),
      );
    }
    if (!lines.length) {
      return languageManager.t('query.noneConfigured', input.language);
    }
    return (
      languageManager.t('query.countHeader', input.language) +
      '\n' +
      lines.join('\n')
    );
  }

  private listRecords(
    entity: EntityType,
    records: EntityRecord[],
    language: SupportedLanguage,
  ): string {
    const limit = Math.min(records.length, 5);
    const lines = records.slice(0, limit).map((record, index) => {
      return `${index + 1}. ${this.formatter.formatRecord(record, language)}`;
    });
    const more =
      records.length > limit
        ? '\n' +
          languageManager.t('query.moreResults', language, {
            count: records.length - limit,
          })
        : '';
    return (
      languageManager.t('query.listHeader', language, {
        entity: plural(entity, language),
        count: records.length,
      }) +
      '\n' +
      lines.join('\n') +
      more
    );
  }

  private failure(
    message: string,
    entity: EntityType,
    language: SupportedLanguage,
  ): string {
    if (message.includes('not configured')) {
      return languageManager.t('query.notConfigured', language, {
        entity: plural(entity, language),
      });
    }
    return languageManager.t('query.failed', language, {
      entity: plural(entity, language),
      error: message,
    });
  }
}

function plural(entity: EntityType, language: SupportedLanguage): string {
  return languageManager.t(ENTITY_SPECS[entity].pluralKey, language);
}

function detailId(query: EntityQuery): string | undefined {
  const direct = (query as Record<string, unknown>).id;
  if (direct !== undefined && direct !== null && String(direct).trim()) {
    return String(direct).trim();
  }
  const fromText = query.text?.match(/\b\d+\b/)?.[0];
  return fromText;
}
