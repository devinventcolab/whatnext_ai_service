import type { DotnetApiClient } from './dotnet-api.client';
import { vlog } from '../../shared/debug';
import { languageManager } from '../../i18n/language-manager';

export interface DropdownItem {
  id: number;
  name: string;
}

export interface WorklogDropdownsData {
  processPhases: DropdownItem[];
  activities: DropdownItem[];
  competences: DropdownItem[];
}

const DEFAULT_DROPDOWNS: WorklogDropdownsData = {
  processPhases: [
    { id: 4, name: 'complete' },
    { id: 2, name: 'not ready' },
    { id: 1, name: 'ready' },
    { id: 3, name: 'resume' },
  ],
  activities: [
    { id: 3, name: 'exam' },
    { id: 2, name: 'new' },
    { id: 4, name: 'result' },
    { id: 1, name: 'test' },
  ],
  competences: [
    { id: 1, name: 'Finance' },
    { id: 3, name: 'High' },
    { id: 2, name: 'HR' },
    { id: 4, name: 'Low' },
  ],
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class WorklogDropdownsService {
  private static instance: WorklogDropdownsService;
  private cache?: { data: WorklogDropdownsData; fetchedAt: number };

  static getInstance(): WorklogDropdownsService {
    if (!WorklogDropdownsService.instance) {
      WorklogDropdownsService.instance = new WorklogDropdownsService();
    }
    return WorklogDropdownsService.instance;
  }

  async getDropdowns(
    token?: string,
    client?: DotnetApiClient,
  ): Promise<WorklogDropdownsData> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.data;
    }

    if (!token) {
      return this.cache?.data ?? DEFAULT_DROPDOWNS;
    }

    try {
      const activeClient =
        client ??
        new (require('./dotnet-api.client').DotnetApiClient as typeof DotnetApiClient)();
      const res = await activeClient.getWorklogDropdowns(token);
      const data: WorklogDropdownsData = {
        processPhases:
          Array.isArray(res?.data?.processPhases) && res.data.processPhases.length
            ? res.data.processPhases
            : DEFAULT_DROPDOWNS.processPhases,
        activities:
          Array.isArray(res?.data?.activities) && res.data.activities.length
            ? res.data.activities
            : DEFAULT_DROPDOWNS.activities,
        competences:
          Array.isArray(res?.data?.competences) && res.data.competences.length
            ? res.data.competences
            : DEFAULT_DROPDOWNS.competences,
      };

      this.cache = { data, fetchedAt: Date.now() };
      vlog('dropdowns', 'fetched dynamic worklog dropdowns successfully');
      return data;
    } catch (error) {
      vlog('dropdowns', 'failed to fetch dropdowns, using cached/defaults:', (error as Error).message);
      return this.cache?.data ?? DEFAULT_DROPDOWNS;
    }
  }

  resolveId(
    val: unknown,
    items: DropdownItem[],
    defaultId: string = '1',
  ): string {
    if (val === undefined || val === null || val === '') return defaultId;
    const strVal = String(val).trim();
    if (/^\d+$/.test(strVal)) return strVal;

    const lowerVal = strVal.toLowerCase();

    // 1. Direct match with API item name
    const directMatch = items.find(
      (item) => item.name.toLowerCase() === lowerVal,
    );
    if (directMatch) return String(directMatch.id);

    // 2. Match with i18n translations across supported languages (en, sr)
    for (const item of items) {
      const rawKey = item.name.toLowerCase();
      const normKey = rawKey.replace(/\s+/g, '_');
      for (const lang of languageManager.supportedLanguages) {
        const t1 = languageManager.t(`enum.${rawKey}`, lang);
        const t2 = languageManager.t(`enum.${normKey}`, lang);
        if (
          (t1 && t1.toLowerCase() === lowerVal) ||
          (t2 && t2.toLowerCase() === lowerVal)
        ) {
          return String(item.id);
        }
      }
    }

    return defaultId;
  }
}

export const worklogDropdownsService = WorklogDropdownsService.getInstance();
